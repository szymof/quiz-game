import questionsData from '../questions.json'
import { v4 as uuidv4 } from 'uuid'

export interface Player {
  id: string
  name: string
  score: number
  socketId: string
  connected: boolean
}

export interface Question {
  question: string
  answers: string[]
  correctIndex: number
}

// Extended status to include voting and round transitions
export type GameStatus = 'waiting' | 'voting' | 'round_intro' | 'question' | 'round_summary' | 'ranking' | 'game_over'

export const GAME_CONSTANTS = {
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  TOTAL_ROUNDS: 3,
  QUESTIONS_PER_ROUND: 5,
  VOTING_DURATION: 10, 
  QUESTION_DURATION: 10 // seconds
}

const AVAILABLE_NAMES = [
  '🦄 Fioletowy Jednorożec',
  '🐸 Żaba w Kapeluszu',
  '🐢 Żółw Turbo',
  '🦊 Lis Kombinator',
  '🐼 Panda na Wakacjach',
  '🦉 Sowa Filozof',
  '🐔 Kura Wojowniczka',
  '🐷 Pan Prosiak',
  '🐍 Wąż Elegancik',
  '🦖 Dinozaur z Przyszłości'
]

export class GameState {
  id: string
  hostSocketId: string

  constructor(id: string, hostSocketId: string) {
    this.id = id
    this.hostSocketId = hostSocketId
  }

  players: Map<string, Player> = new Map()
  gameStatus: GameStatus = 'waiting'
  
  // Game Cycle State
  currentRound: number = 0
  usedCategories: Set<string> = new Set()
  currentCategory: string = ''
  
  // Question State
  currentQuestions: Question[] = []
  currentQuestionIndex: number = -1
  questionStartTime: number = 0
  votes: Map<string, string> = new Map()
  answers: Map<string, number> = new Map() // playerId -> answerIndex
  readyPlayers: Set<string> = new Set() // Track who is ready for next question

  // Question & Scoring State
  questionTimer: NodeJS.Timeout | null = null

  // Helper to get random available name
  private getUniqueName(): string {
    const usedNames = new Set(Array.from(this.players.values()).map(p => p.name))
    const available = AVAILABLE_NAMES.filter(name => !usedNames.has(name))
    if (available.length === 0) return `Gracz ${this.players.size + 1}`
    const randomIndex = Math.floor(Math.random() * available.length)
    return available[randomIndex]
  }

  // --- Core Methods ---
  
  markPlayerReady(playerId: string): boolean {
    this.readyPlayers.add(playerId)
    // Only count connected players
    const connectedCount = Array.from(this.players.values()).filter(p => p.connected).length
    return this.readyPlayers.size >= connectedCount
  }

  resetReadyState() {
    this.readyPlayers.clear()
  }

  joinGame(socketId: string, playerId?: string): { player: Player, reconnected: boolean } {
    // Try to reconnect existing player
    if (playerId && this.players.has(playerId)) {
      const player = this.players.get(playerId)!
      player.socketId = socketId
      player.connected = true
      return { player, reconnected: true }
    }

    if (this.players.size >= GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error('Gra jest pełna')
    }
    
    // Block join if game is strictly in progress (anything other than waiting)
    if (this.gameStatus !== 'waiting') {
       throw new Error('Gra już trwa')
    }

    const newPlayer: Player = {
      id: uuidv4(),
      name: this.getUniqueName(),
      score: 0,
      socketId,
      connected: true
    }

    this.players.set(newPlayer.id, newPlayer)
    return { player: newPlayer, reconnected: false }
  }

  disconnectPlayer(socketId: string) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.connected = false
        break
      }
    }
  }

  removePlayer(playerId: string) {
    if (this.players.has(playerId)) {
      this.players.delete(playerId)
      this.votes.delete(playerId)
      this.answers.delete(playerId)
    }
  }

  // --- Game Flow Methods ---

  startGame() {
    if (this.players.size < GAME_CONSTANTS.MIN_PLAYERS) {
      throw new Error('Za mało graczy by rozpocząć')
    }
    this.currentRound = 0
    this.usedCategories.clear()
    this.startNextRound()
  }

  private finishRound() {
    this.gameStatus = 'ranking'
    this.currentCategory = ''
    this.resetReadyState()
    
    // Check if game over
    if (this.currentRound >= GAME_CONSTANTS.TOTAL_ROUNDS) {
      this.gameStatus = 'game_over'
    }
  }

  startNextRound() {
    this.currentRound++
    if (this.currentRound > GAME_CONSTANTS.TOTAL_ROUNDS) {
      this.gameStatus = 'game_over'
      return
    }
    
    // Start Voting Phase
    this.gameStatus = 'voting'
    this.votes.clear()
    this.resetReadyState()
  }

  submitVote(playerId: string, category: string) {
    if (this.gameStatus !== 'voting') return
    if (this.usedCategories.has(category)) return // Should not happen if UI is correct
    
    this.votes.set(playerId, category)
  }

  allVoted(): boolean {
    const connectedCount = Array.from(this.players.values()).filter(p => p.connected).length
    return this.votes.size >= connectedCount
  }

  endVoting(): string {
    // Count votes
    const voteCounts: Record<string, number> = {}
    for (const cat of this.votes.values()) {
      voteCounts[cat] = (voteCounts[cat] || 0) + 1
    }

    // Find winner
    let maxVotes = 0
    let candidates: string[] = []
    
    const allCategories = Object.keys(questionsData).filter(c => !this.usedCategories.has(c))
    
    if (allCategories.length === 0) {
      throw new Error('No categories left!')
    }

    // If no votes, random from all available
    if (this.votes.size === 0) {
      candidates = allCategories
    } else {
      // Determine max
      for (const [cat, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count
          candidates = [cat]
        } else if (count === maxVotes) {
          candidates.push(cat)
        }
      }
    }

    // Resolve tie randomly
    const winner = candidates[Math.floor(Math.random() * candidates.length)]
    
    this.currentCategory = winner
    this.usedCategories.add(winner)
    this.prepareQuestions(winner)
    this.gameStatus = 'round_intro'
    
    return winner
  }

  private prepareQuestions(category: string) {
    const allQuestions = (questionsData as Record<string, Question[]>)[category] || []
    // Shuffle and pick 5
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
    this.currentQuestions = shuffled.slice(0, GAME_CONSTANTS.QUESTIONS_PER_ROUND)
    this.currentQuestionIndex = -1
  }

  nextQuestion() {
    this.currentQuestionIndex++
    if (this.currentQuestionIndex >= this.currentQuestions.length) {
      // End of Round
      this.gameStatus = 'ranking'
      this.resetReadyState()
      // Sort players by score for the ranking display? The UI sorts them, but we set status
      return { finished: false, roundOver: true }
    }
    
    this.gameStatus = 'question'
    this.answers.clear()
    this.resetReadyState()
    this.questionStartTime = Date.now()
    
    // Clear any existing timer
    if (this.questionTimer) clearTimeout(this.questionTimer)
    
    // Auto-close question after 15s if not everyone answers
    // Note: We need the IO instance to broadcast timeout, so we might need to rely on the caller/host or 
    // handle it differently. Ideally, the controller sets the timeout.
    // For now, we'll store the start time and let the host controller manage the timeout or check on answer.
    
    return { 
      finished: false, 
      roundOver: false,
      question: this.currentQuestions[this.currentQuestionIndex] 
    }
  }

  submitAnswer(playerId: string, answerIndex: number) {
    if (this.gameStatus !== 'question') return
    if (this.answers.has(playerId)) return // Already answered
    
    this.answers.set(playerId, answerIndex)
    
    // Calculate Score
    const currentQ = this.currentQuestions[this.currentQuestionIndex]
    console.log(`Player ${playerId} answered ${answerIndex}. Correct: ${currentQ?.correctIndex}`)
    
    if (currentQ && answerIndex === currentQ.correctIndex) {
      const now = Date.now()
      const timeTaken = (now - this.questionStartTime) / 1000 // seconds
      console.log(`Time taken: ${timeTaken}s. Start: ${this.questionStartTime}, Now: ${now}`)
      
      // Check if within time limit (give a small buffer for latency)
      if (timeTaken <= GAME_CONSTANTS.QUESTION_DURATION + 2) { // Increased buffer slightly
        // Points: 15 - timeTaken. Min 0.
        const points = Math.max(0, 15 - Math.floor(timeTaken))
        
        // FIND PLAYER BY SOCKET ID
        const player = Array.from(this.players.values()).find(p => p.socketId === playerId)
        
        console.log(`Awarding ${points} points to ${player?.name} (${playerId})`)
        
        if (player) {
           player.score += points
        }
      } else {
         console.log('Time limit exceeded for score')
      }
    }
  }
  
  // Check if all players answered
  allAnswered(): boolean {
    const connectedCount = Array.from(this.players.values()).filter(p => p.connected).length
    return this.answers.size >= connectedCount
  }

  restartGame() {
    this.gameStatus = 'waiting'
    this.currentRound = 0
    this.usedCategories.clear()
    this.currentQuestions = []
    this.currentQuestionIndex = -1
    this.votes.clear()
    this.answers.clear()
    if (this.questionTimer) clearTimeout(this.questionTimer)
    
    // Reset scores
    for (const player of this.players.values()) {
      player.score = 0
    }
  }

  getPublicState() {
    // Hide correct answers during question phase? 
    // Usually we just send the question text and answers options.
    
    return {
      gameId: this.id,
      players: Array.from(this.players.values()).sort((a,b) => b.score - a.score),
      status: this.gameStatus,
      readyToStart: this.players.size >= GAME_CONSTANTS.MIN_PLAYERS,
      round: this.currentRound,
      totalRounds: GAME_CONSTANTS.TOTAL_ROUNDS,
      currentCategory: this.currentCategory,
      availableCategories: Object.keys(questionsData).filter(c => !this.usedCategories.has(c)),
      questionIndex: this.currentQuestionIndex + 1,
      totalQuestions: GAME_CONSTANTS.QUESTIONS_PER_ROUND,
      currentQuestion: this.gameStatus === 'question' ? {
        question: this.currentQuestions[this.currentQuestionIndex].question,
        answers: this.currentQuestions[this.currentQuestionIndex].answers,
        // No correctIndex here
      } : null,
      questionStartTime: this.gameStatus === 'question' ? this.questionStartTime : null
    }
  }
  
  // Helper to reveal answer (optional context for clients)
  getCorrectAnswerIndex() {
      if (this.gameStatus !== 'question') return -1
      return this.currentQuestions[this.currentQuestionIndex]?.correctIndex ?? -1
  }
  
  // Get answer distribution with player info
  getAnswerDistribution() {
      if (this.gameStatus !== 'question') return []
      
      const distribution: { answerIndex: number, players: { id: string, name: string }[] }[] = []
      const answersCount = this.currentQuestions[this.currentQuestionIndex]?.answers.length || 0
      
      // Initialize distribution for each answer
      for (let i = 0; i < answersCount; i++) {
          distribution.push({ answerIndex: i, players: [] })
      }
      
      // Map answers by socket ID to player names
      for (const [socketId, answerIndex] of this.answers.entries()) {
          const player = Array.from(this.players.values()).find(p => p.socketId === socketId)
          if (player && answerIndex < answersCount) {
              distribution[answerIndex].players.push({ id: player.id, name: player.name })
          }
      }
      
      return distribution
  }
}

class GameManager {
  private games: Map<string, GameState> = new Map()

  createGame(hostSocketId: string): GameState {
    const id = this.generateGameId()
    const game = new GameState(id, hostSocketId)
    this.games.set(id, game)
    return game
  }

  getGame(id: string): GameState | undefined {
    return this.games.get(id)
  }

  // Find game by socket ID (searching players + host)
  findGameBySocketId(socketId: string): GameState | undefined {
    for (const game of this.games.values()) {
        if (game.hostSocketId === socketId) return game
        // Search players
        for (const player of game.players.values()) {
            if (player.socketId === socketId) return game
        }
    }
    return undefined
  }

  removeGame(id: string) {
    this.games.delete(id)
  }

  private generateGameId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No confusing chars like I, 1, 0, O
    let result = ''
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    // Ensure uniqueness
    if (this.games.has(result)) return this.generateGameId()
    return result
  }
}

export const gameManager = new GameManager()
