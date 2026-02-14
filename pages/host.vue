<template>
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; color: #333;">
    
    <!-- 1. Game Creation Screen -->
    <div v-if="!gameId" style="text-align: center; margin-top: 100px;">
        <h1 style="font-size: 2.5em; margin-bottom: 30px;">Panel Gospodarza</h1>
        <p style="font-size: 1.2em; color: #666; margin-bottom: 40px;">Rozpocznij nową sesję teleturnieju!</p>
        <button 
          @click="createGame" 
          style="padding: 20px 50px; font-size: 1.5em; background: #2196F3; color: white; border: none; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s;"
          onmouseover="this.style.transform='scale(1.05)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          Utwórz Grę
        </button>
    </div>

    <!-- 2. Lobby Screen (Waiting) -->
    <div v-else-if="gameState?.status === 'waiting'" style="text-align: center;">
       <div style="margin-bottom: 40px;">
          <h1 style="font-size: 3em; margin: 20px 0; color: #333;">Dołącz do gry</h1>
          <p style="font-size: 1.5em; color: #666;">Zeskanuj kod QR telefonem, aby dołączyć!</p>
       </div>

       <div style="display: flex; justify-content: center; align-items: flex-start; gap: 60px; flex-wrap: wrap;">
          <!-- QR Code Section -->
          <div style="background: white; padding: 20px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;">
             <img v-if="qrCodeData" :src="qrCodeData" alt="QR" style="width: 300px; height: 300px; display: block;" />
             <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
               <p style="margin: 0; font-size: 0.9em; color: #666; margin-bottom: 5px;">Kod gry:</p>
               <p style="margin: 0; font-size: 2em; font-family: monospace; letter-spacing: 5px; font-weight: bold; color: #1565C0;">{{ gameId }}</p>
             </div>
          </div>

          <!-- Players List Section -->
          <div style="flex: 1; min-width: 300px; max-width: 400px; text-align: left;">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Gracze ({{ connectedPlayers.length }})</h2>
                <div v-if="connectedPlayers.length < 2" style="color: #f44336; font-size: 0.9em;">
                   Min. 2 graczy
                </div>
                <div v-else style="color: #4CAF50; font-size: 0.9em;">
                   Gotowi do startu!
                </div>
             </div>

             <ul style="list-style: none; padding: 0; max-height: 400px; overflow-y: auto;">
                <li v-if="connectedPlayers.length === 0" style="padding: 20px; text-align: center; color: #999; font-style: italic; background: #f9f9f9; border-radius: 10px;">
                   Czekanie na graczy...
                </li>
                <li v-for="player in connectedPlayers" :key="player.id" 
                    style="padding: 15px; margin-bottom: 10px; background: white; border-radius: 10px; display: flex; align-items: center; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #4CAF50;"></div>
                    <span style="font-size: 1.2em; font-weight: 500;">{{ player.name }}</span>
                    <button 
                       @click="removePlayer(player.id)" 
                       style="margin-left: auto; background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.2em; padding: 5px;"
                       title="Usuń gracza"
                    >
                       &times;
                    </button>
                </li>
             </ul>

             <div style="margin-top: 30px;">
                <button 
                   @click="startGame"
                   :disabled="connectedPlayers.length < 2"
                   style="width: 100%; padding: 20px; font-size: 1.3em; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 12px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: opacity 0.2s;"
                   :style="{ opacity: connectedPlayers.length < 2 ? 0.5 : 1, cursor: connectedPlayers.length < 2 ? 'not-allowed' : 'pointer' }"
                >
                   Rozpocznij Grę
                </button>
             </div>
          </div>
       </div>
    </div>

    <!-- 3. Active Game Dashboard -->
    <div v-else style="display: flex; gap: 40px; margin-top: 20px;">
      <!-- Main Game Area -->
      <div style="flex: 2;">
        
        <!-- Header for running game -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #666; margin: 0;">Panel Gospodarza</h2>
          <!-- You can add round info here back if requested later -->
        </div>

        <!-- Voting Phase -->
        <div v-if="gameState?.status === 'voting'" style="text-align: center; margin-top: 50px;">
          <h1 style="font-size: 2.5em; color: #333; margin-bottom: 30px;">Zagłosuj na kategorię!</h1>
          
          <!-- Voting Timer Bar -->
          <div style="margin: 0 auto 40px; max-width: 600px;">
            <div style="height: 20px; background: #eee; border-radius: 10px; overflow: hidden;">
              <div :style="{ width: votingTimerProgress + '%', background: '#4CAF50', height: '100%', transition: 'width 0.1s linear' }"></div>
            </div>
            <p style="margin-top: 10px; color: #666; font-size: 1.1em;">Czas na głosowanie...</p>
          </div>

          <!-- Categories Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 800px; margin: 0 auto;">
            <div v-for="cat in gameState.availableCategories" :key="cat" 
                 style="padding: 30px; background: #e3f2fd; border-radius: 12px; font-size: 1.3em; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              {{ cat }}
            </div>
          </div>
        </div>

        <!-- Question Phase -->
        <div v-else-if="gameState?.status === 'question'" style="text-align: center; margin-top: 100px;">
          <div style="font-size: 4em; margin-bottom: 30px;">📱</div>
          <h1 style="font-size: 2.5em; color: #333; margin-bottom: 20px;">Rozgrywka trwa na telefonach!</h1>
          <p style="font-size: 1.5em; color: #666;">Gracze odpowiadają na pytania...</p>
          <p style="font-size: 1.2em; color: #999; margin-top: 20px;">Kategoria: <strong>{{ gameState.currentCategory }}</strong></p>
        </div>

        <!-- Round Intro -->
        <div v-else-if="gameState?.status === 'round_intro'" style="text-align: center; margin-top: 100px;">
          <h2 style="font-size: 1.8em; color: #666; margin-bottom: 20px;">Wybrana kategoria:</h2>
          <h1 style="font-size: 3.5em; color: #2196F3; margin-bottom: 30px;">{{ gameState.currentCategory }}</h1>
          <p style="font-size: 1.3em; color: #999;">Przygotujcie się...</p>
        </div>

        <!-- Ranking Phase -->
        <div v-else-if="gameState?.status === 'ranking'" style="text-align: center; margin-top: 50px;">
          <h2 style="font-size: 2em; color: #333; margin-bottom: 30px;">👀 Sprawdźcie wyniki na telefonach!</h2>
          <p style="font-size: 1.3em; color: #666; margin-bottom: 40px;">Koniec Rundy {{ gameState.round }}</p>
        </div>

        <!-- Game Over -->
        <div v-else-if="gameState?.status === 'game_over'" style="text-align: center;">
          <h2 style="font-size: 2.5em; color: #333; margin-bottom: 40px;">Koniec Gry!</h2>
          
          <!-- Bar Chart Container -->
          <div style="display: flex; justify-content: center; align-items: flex-end; gap: 20px; height: 300px; margin-bottom: 50px; padding: 0 40px;">
             <div v-for="(player, idx) in connectedPlayers" :key="player.id" 
                  style="display: flex; flex-direction: column; align-items: center; width: 60px;">
                
                <div style="font-weight: bold; margin-bottom: 5px;">{{ player.score }}</div>
                
                <!-- Bar -->
                <div :style="{ 
                   height: Math.max(10, (player.score / (maxScore || 1)) * 200) + 'px',
                   width: '100%',
                   background: idx === 0 ? '#FFD700' : (idx === 1 ? '#C0C0C0' : (idx === 2 ? '#CD7F32' : '#2196F3')),
                   borderRadius: '5px 5px 0 0',
                   transition: 'height 1s ease-out'
                }"></div>
                
                <!-- Name -->
                <div style="margin-top: 10px; font-size: 0.8em; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
                  {{ player.name }}
                </div>
                
                <!-- Medal/Icon for Top 3 -->
                <div v-if="idx < 3" style="font-size: 1.5em; margin-top: 5px;">
                   {{ idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉') }}
                </div>
             </div>
          </div>

          <button @click="resetToCreateGame" style="padding: 20px 40px; background: #2196F3; color: white; border: none; border-radius: 8px; font-size: 1.2em; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            Rozpocznij nową grę
          </button>
        </div>

      </div>

      <!-- Leaderboard / Players -->
      <div style="flex: 1; border-left: 1px solid #ccc; padding-left: 20px;">
        
        <!-- QR Code (Always visible for late joins blocking or just info) -->
        <div style="margin-top: 20px; text-align: center;">
          <img v-if="qrCodeData" :src="qrCodeData" alt="QR" style="width: 150px; height: 150px;" />
          <p style="font-size: 0.8em; word-break: break-all;">
            <a :href="playerUrl" target="_blank">{{ playerUrl }}</a>
          </p>
          <p style="font-weight: bold; margin-top: 10px;">Kod: {{ gameId }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import QRCode from 'qrcode'

const { $socket } = useNuxtApp()
const connectedPlayers = ref([])
const gameState = ref(null)
const qrCodeData = ref('')
const playerUrl = ref('')
const gameId = ref('')

const revealed = ref(false)
const correctAnswerIndex = ref(-1)
const votingTimerProgress = ref(100)
let votingTimerInterval = null

onMounted(async () => {
  // Socket listeners
  $socket.on('game-state', (state) => {
    // Reset revealed state on new question
    if (gameState.value?.status === 'question' && state.status === 'question' && 
        gameState.value?.currentQuestion?.question !== state.currentQuestion?.question) {
       revealed.value = false
       correctAnswerIndex.value = -1
    }
    
    // Handle voting timer
    if (state.status === 'voting' && gameState.value?.status !== 'voting') {
      startVotingTimer()
    } else if (state.status !== 'voting' && votingTimerInterval) {
      stopVotingTimer()
    }
    
    gameState.value = state
    connectedPlayers.value = state.players
  })
  
  $socket.on('category-selected', (cat) => {
    console.log('Category selected:', cat)
  })

  $socket.on('question-timeout', ({ correctAnswerIndex: idx }) => {
     revealed.value = true
     correctAnswerIndex.value = idx
  })
})

async function createGame() {
    $socket.emit('create-game', async (response) => {
        if (response && response.gameId) {
            gameId.value = response.gameId
            await generateJoinLink(response.gameId)
        }
    })
}

async function generateJoinLink(id) {
  // Determine network URL
  try {
    const { ip } = await $fetch('/api/info')
    const protocol = window.location.protocol
    const port = window.location.port
    let baseUrl = ''
    if (ip && ip !== 'localhost' && window.location.hostname === 'localhost') {
      baseUrl = `${protocol}//${ip}:${port}`
    } else {
      baseUrl = `${protocol}//${window.location.hostname}:${port}`
    }
    
    // Append gameId query param
    playerUrl.value = `${baseUrl}?gameId=${id}`
    
    qrCodeData.value = await QRCode.toDataURL(playerUrl.value)
  } catch (e) {
    console.error('QR Gen error', e)
    playerUrl.value = `${window.location.origin}?gameId=${id}`
  }
}

const maxScore = computed(() => {
  if (!connectedPlayers.value.length) return 1
  return Math.max(...connectedPlayers.value.map(p => p.score))
})

function startVotingTimer() {
  stopVotingTimer()
  const duration = 10
  const startTime = Date.now()
  
  votingTimerProgress.value = 100
  votingTimerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000
    const percent = Math.max(0, 100 - (elapsed / duration * 100))
    votingTimerProgress.value = percent
    
    if (percent <= 0) stopVotingTimer()
  }, 100)
}

function stopVotingTimer() {
  if (votingTimerInterval) {
    clearInterval(votingTimerInterval)
    votingTimerInterval = null
  }
}

function resetToCreateGame() {
  if (confirm('Czy chcesz zakończyć tę sesję i utworzyć nową?')) {
      gameId.value = null
      gameState.value = null
      connectedPlayers.value = []
      qrCodeData.value = ''
      // Optionally emit a 'close-game' event to server if we implemented cleanup
  }
}

function startGame() {
  $socket.emit('start-game')
}

function endVoting() {
  $socket.emit('end-voting')
}

function nextQuestion() {
  $socket.emit('next-question')
}

function startNextRound() {
  $socket.emit('start-next-round')
}

function restartGame() {
  if (confirm('Czy na pewno chcesz zrestartować grę?')) {
    $socket.emit('restart-game')
  }
}

function removePlayer(playerId) {
  if (confirm('Czy na pewno chcesz usunąć tego gracza?')) {
    $socket.emit('remove-player', { playerId })
  }
}
</script>
