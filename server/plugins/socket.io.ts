import { Server as SocketServer } from 'socket.io'
import { gameManager } from '../utils/gameState'

const votingTimers = new Map<string, NodeJS.Timeout>()
const questionTimers = new Map<string, NodeJS.Timeout>()

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    // @ts-expect-error: Raw socket access
    const socket = event.node.req.socket
    // @ts-expect-error: Server access
    const server = socket?.server

    if (server && !server.io) {
      console.log('Initializing Socket.io server...')
      const io = new SocketServer(server, {
        pingTimeout: 60000,
        pingInterval: 25000,
        cors: {
          origin: "*"
        }
      })
      server.io = io

      // Global error handler for the IO server
      io.engine.on("connection_error", (err) => {
        console.error('Socket.io connection error:', err.message, err.context)
      })

      // Add process-level error handling to capture and log ECONNRESET and others
      if (!process.listenerCount('unhandledRejection')) {
        process.on('unhandledRejection', (reason, promise) => {
          console.error('Unhandled Rejection at:', promise, 'reason:', reason)
        })
      }
      
      if (!process.listenerCount('uncaughtException')) {
        process.on('uncaughtException', (err) => {
          console.error('Uncaught Exception:', err)
        })
      }

      const broadcastState = (gameId: string) => {
         const game = gameManager.getGame(gameId)
         if (game) {
            io.to(`game-${gameId}`).emit('game-state', game.getPublicState())
         }
      }

      const endQuestion = (gameId: string) => {
         const timer = questionTimers.get(gameId)
         if (timer) {
             clearTimeout(timer)
             questionTimers.delete(gameId)
         }
         
         const game = gameManager.getGame(gameId)
         if (game) {
             io.to(`game-${gameId}`).emit('question-timeout', { 
                 correctAnswerIndex: game.getCorrectAnswerIndex(),
                 answerDistribution: game.getAnswerDistribution()
             })
         }
      }

      const startQuestion = (gameId: string) => {
           // Clear previous timer if any
           if (questionTimers.has(gameId)) {
               clearTimeout(questionTimers.get(gameId))
               questionTimers.delete(gameId)
           }
           
           const game = gameManager.getGame(gameId)
           if (!game) return

           const result = game.nextQuestion()
           broadcastState(gameId)
           
           if (!result.roundOver && !result.finished) {
             // Start timer for 10s + buffer
             const timer = setTimeout(() => {
                endQuestion(gameId)
             }, 12000) // 10s + 2s buffer
             questionTimers.set(gameId, timer)
           }
      }

      const endVoting = (gameId: string) => {
         if (votingTimers.has(gameId)) {
             clearTimeout(votingTimers.get(gameId))
             votingTimers.delete(gameId)
         }
         
         const game = gameManager.getGame(gameId)
         if (!game) return

         try {
             const winner = game.endVoting()
             io.to(`game-${gameId}`).emit('category-selected', winner)
             broadcastState(gameId)
             
             // Auto-start first question after short delay
             setTimeout(() => {
                 startQuestion(gameId)
             }, 2000)
         } catch(e: any) {
             console.error('Voting end error:', e.message)
         }
      }
      
      const startVotingTimer = (gameId: string) => {
          if (votingTimers.has(gameId)) clearTimeout(votingTimers.get(gameId))
          const timer = setTimeout(() => {
              endVoting(gameId)
          }, 11000) // 10s + 1s buffer
          votingTimers.set(gameId, timer)
      }


      io.on('connection', (socket) => {
        console.log('Client connected:', socket.id)

        // Error handling for individual socket
        socket.on('error', (err) => {
            console.error(`Socket error for ${socket.id}:`, err)
        })

        // Helper to get game from socket rooms or data
        // We will store gameId in socket.data for convenience
        const getGameId = () => socket.data.gameId

        // Handle Host Creating Game
        socket.on('create-game', (callback) => {
            const game = gameManager.createGame(socket.id)
            socket.data.gameId = game.id
            socket.join(`game-${game.id}`)
            console.log(`Game created: ${game.id} by host ${socket.id}`)
            
            // Return game ID to host
            if (typeof callback === 'function') callback({ gameId: game.id })
            
            broadcastState(game.id)
        })

        // Handle joining
        socket.on('join-game', ({ playerId, gameId }) => {
          try {
            // Fix: Check if game exists
            const game = gameManager.getGame(gameId)
            if (!game) {
                socket.emit('error', 'Gra nie istnieje')
                return
            }

            const { player, reconnected } = game.joinGame(socket.id, playerId)
            
            socket.data.gameId = gameId
            socket.join(`game-${gameId}`)
            
            socket.emit('player-joined', player)
            broadcastState(gameId)
            console.log(`Player ${player.name} (${player.id}) ${reconnected ? 'reconnected' : 'joined'} game ${gameId}`)
          } catch (e: any) {
            socket.emit('error', e.message)
          }
        })

        // Handle Host events
        // Note: Host join logic is now covered by create-game or host re-joining via ID? 
        // For now, assuming host stays connected. If host refreshes, they need to re-identify?
        // TODO: Handle host reconnection or keep it simple.
        
        // This is legacy "host-join" from singleton version. 
        // In new version, host creates game. If host reconnects, they might need to "claim" the game.
        // For simplicity, we'll assume host doesn't refresh or uses local storage to remember gameId?
        // Let's add 'host-reconnect' maybe? Or just rely on create-game for now.

        socket.on('start-game', () => {
          const gameId = getGameId()
          const game = gameManager.getGame(gameId)
          if (!game) return

          try {
            game.startGame()
            broadcastState(gameId)
            startVotingTimer(gameId) 
            console.log(`Game ${gameId} started by host`)
          } catch (e: any) {
            socket.emit('error', e.message)
          }
        })

        socket.on('submit-vote', ({ category }) => {
           const gameId = getGameId()
           const game = gameManager.getGame(gameId)
           if (!game) return

           game.submitVote(socket.id, category)
           broadcastState(gameId) 
           
           if (game.allVoted()) {
               endVoting(gameId)
           }
        })

        socket.on('end-voting', () => {
           const gameId = getGameId()
           if (gameId) endVoting(gameId)
        })
        
        socket.on('next-question', () => {
           const gameId = getGameId()
           if (gameId) startQuestion(gameId)
        })

        socket.on('start-next-round', () => {
           const gameId = getGameId()
           const game = gameManager.getGame(gameId)
           if (!game) return

           game.startNextRound()
           broadcastState(gameId)
           startVotingTimer(gameId) 
        })

        socket.on('submit-answer', ({ answerIndex }) => {
           const gameId = getGameId()
           const game = gameManager.getGame(gameId)
           if (!game) return

           game.submitAnswer(socket.id, answerIndex)
           broadcastState(gameId)
           
           if (game.allAnswered()) {
             if (questionTimers.has(gameId)) {
                 clearTimeout(questionTimers.get(gameId))
                 questionTimers.delete(gameId)
             }
             // Reveal immediately
             io.to(`game-${gameId}`).emit('question-timeout', { 
                 correctAnswerIndex: game.getCorrectAnswerIndex(),
                 answerDistribution: game.getAnswerDistribution()
             })
           }
        })

        socket.on('restart-game', () => {
          const gameId = getGameId()
          const game = gameManager.getGame(gameId)
          if (!game) return

          if (questionTimers.has(gameId)) clearTimeout(questionTimers.get(gameId))
          if (votingTimers.has(gameId)) clearTimeout(votingTimers.get(gameId))
          
          game.restartGame()
          broadcastState(gameId)
          console.log(`Game ${gameId} restarted by host`)
        })

        socket.on('disconnect', () => {
          const gameId = getGameId()
          if (gameId) {
              const game = gameManager.getGame(gameId)
              if (game) {
                  console.log('Client disconnected from game:', gameId, socket.id)
                  game.disconnectPlayer(socket.id)
                  broadcastState(gameId)
                  
                  // If host disconnects?
                  if (game.hostSocketId === socket.id) {
                      console.log('Host disconnected from game', gameId)
                      // Optionally end game or wait for reconnect
                  }
              }
          }
        })

        socket.on('remove-player', ({ playerId }) => {
           const gameId = getGameId()
           const game = gameManager.getGame(gameId)
           if (game) {
               console.log('Removing player:', playerId)
               game.removePlayer(playerId)
               broadcastState(gameId)
           }
        })

        socket.on('player-ready', () => {
           const gameId = getGameId()
           const game = gameManager.getGame(gameId)
           if (game) {
               const allReady = game.markPlayerReady(socket.id)          
               if (allReady) {
                  if (game.gameStatus === 'ranking') {
                     game.startNextRound()
                     broadcastState(gameId)
                     startVotingTimer(gameId)
                  } else {
                     startQuestion(gameId)
                  }
               }
           }
        })

        socket.on('ping', () => {
          socket.emit('pong', { message: 'Hello from server', time: new Date() })
        })
      })
    }
  })
})
