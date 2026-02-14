<template>
  <div class="min-h-svh bg-gradient-to-br from-indigo-500 to-purple-600 font-sans overflow-x-hidden">
    
    <!-- Error Message -->
    <div v-if="error" class="fixed top-5 left-1/2 -translate-x-1/2 z-[1000] max-w-[90%] px-4 py-3 bg-red-500/95 text-white rounded-2xl shadow-lg">
      {{ error }}
    </div>
    
    <!-- Game Join Screen -->
    <div v-if="!joinedGame" class="flex items-center justify-center min-h-svh p-5">
       <div v-if="!isConnected" class="bg-white/95 px-8 py-8 rounded-3xl shadow-2xl">
         <p class="text-indigo-500 text-lg m-0">Łączenie z serwerem...</p>
       </div>
       <div v-else class="bg-white/95 px-7 py-9 rounded-3xl shadow-2xl max-w-[380px] w-full text-center">
         <h1 class="text-indigo-500 text-4xl mb-2 font-bold">Witaj!</h1>
         <p class="text-gray-600 text-sm mb-5">Wpisz kod gry aby dołączyć</p>
         
         <div class="my-5">
           <input 
              v-model="inputGameCode" 
              placeholder="XXXX" 
              class="px-3 py-3 text-2xl uppercase text-center w-full border-3 border-gray-200 rounded-2xl font-bold tracking-[0.375rem] text-indigo-500 box-border focus:outline-none focus:border-indigo-500" 
              maxlength="4"
           />
         </div>
         
         <button 
           @click="joinGameManual"
           :disabled="!inputGameCode"
           class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-2xl text-lg font-semibold shadow-lg shadow-indigo-500/40 transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5"
         >
           WEJDŹ DO GRY
         </button>
       </div>
    </div>

    <div v-else-if="isConnected && gameState">
      
      <!-- WAITING -->
      <div v-if="gameState.status === 'waiting'" class="flex items-center justify-center min-h-svh p-5">
        <div class="bg-white/95 px-6 py-8 rounded-3xl shadow-2xl text-center max-w-[400px] w-full">
          <div class="text-5xl mb-3">⏳</div>
          <h1 class="text-indigo-500 text-3xl mb-2">Poczekalnia</h1>
          <p class="text-gray-600 text-base mb-4">Czekamy na start...</p>
          <div class="mt-4 p-3 bg-gray-100 rounded-xl">
            <p class="m-0 text-indigo-500 font-semibold text-base">{{ myPlayer?.name }}</p>
          </div>
        </div>
      </div>

      <!-- ROUND INTRO -->
      <div v-else-if="gameState.status === 'round_intro'" class="flex items-center justify-center min-h-svh p-5">
        <div class="bg-white/95 px-8 py-12 rounded-3xl shadow-2xl text-center max-w-[500px] w-full">
          <h2 class="text-gray-600 text-xl mb-4 font-normal">Wybrana Kategoria:</h2>
          <h1 class="text-indigo-500 text-4xl m-0 font-bold leading-tight">{{ gameState.currentCategory }}</h1>
          <p class="text-gray-400 text-lg mt-6">Przygotuj się!</p>
        </div>
      </div>

      <!-- VOTING -->
      <div v-else-if="gameState.status === 'voting'" class="flex flex-col h-svh">
        <!-- Timer Bar - Fixed Top -->
        <div class="fixed top-0 left-0 right-0 h-1.5 bg-black/10 z-[100]">
           <div :style="{ width: votingTimerProgress + '%' }" class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-[width] duration-100 linear"></div>
        </div>

        <div class="flex-1 flex flex-col justify-center px-5 pt-10 pb-8">
          <div class="bg-white/95 p-8 rounded-3xl shadow-2xl max-w-[500px] w-full mx-auto">
            <h2 class="text-indigo-500 text-3xl mb-5 text-center font-semibold">Wybierz Kategorię</h2>

            <div v-if="!selectedVote" class="flex flex-col gap-3">
              <button 
                v-for="cat in gameState.availableCategories" 
                :key="cat"
                @click="vote(cat)"
                class="p-4 border-none rounded-2xl text-lg cursor-pointer bg-white text-gray-800 font-medium shadow-md transition-transform hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/30"
              >
                {{ cat }}
              </button>
            </div>
            <div v-else class="text-center py-8">
               <div class="text-5xl mb-4">✓</div>
               <h3 class="text-indigo-500 m-0 mb-2">Twój głos:</h3>
               <p class="text-xl text-gray-800 font-semibold">{{ selectedVote }}</p>
               <p class="text-gray-400 mt-4 text-sm">Oczekiwanie...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- QUESTION -->
      <div v-else-if="gameState.status === 'question' && gameState.currentQuestion" class="flex flex-col h-svh">
        
        <!-- Timer Bar - Fixed Top -->
        <div class="fixed top-0 left-0 right-0 h-1.5 bg-black/10 z-[100]">
           <div :style="{ width: timerProgress + '%' }" class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-[width] duration-100 linear"></div>
        </div>

        <!-- Question Screen (unrevealed) -->
        <div v-if="!revealed" class="flex-1 flex flex-col p-5 pt-8 overflow-y-auto">
          
          <div class="bg-white/95 p-5 rounded-2xl shadow-2xl mb-auto">
            
            <!-- Header -->
            <div class="flex justify-between items-center mb-4">
              <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {{ gameState.questionIndex }}/{{ gameState.totalQuestions }}
              </div>
              <div class="text-indigo-500 font-semibold text-lg">{{ myPlayer?.score }} pkt</div>
            </div>

            <h3 class="text-gray-400 text-xs m-0 mb-2 font-medium uppercase tracking-wider">{{ gameState.currentCategory }}</h3>
            <h2 class="text-gray-800 text-2xl m-0 mb-5 leading-snug font-semibold">{{ gameState.currentQuestion.question }}</h2>
            
            <!-- Answers Grid (2 columns) -->
            <div class="grid grid-cols-2 gap-2">
              <button 
                 v-for="(ans, idx) in gameState.currentQuestion.answers" 
                 :key="idx"
                 @click="submitAnswer(idx)"
                 :disabled="selectedAnswer !== null"
                 :class="[
                   'p-4 rounded-xl text-base font-medium border-3 transition-all text-center min-h-[70px] flex items-center justify-center',
                   selectedAnswer === idx ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-500' : 'bg-white text-gray-800 border-gray-200',
                   selectedAnswer !== null && selectedAnswer !== idx ? 'opacity-50' : 'opacity-100',
                   selectedAnswer !== null ? 'cursor-not-allowed' : 'cursor-pointer'
                 ]"
              >
                {{ ans }}
              </button>
            </div>

            <div v-if="selectedAnswer !== null" class="mt-4 text-center text-indigo-500 text-sm italic">
              Odpowiedź wysłana!
            </div>
          </div>
        </div>
        
        <!-- Results Screen (revealed) -->
        <div v-else-if="!showDistribution" class="flex-1 flex flex-col justify-center p-5 pt-8">
          <div class="bg-white/95 px-5 py-6 rounded-2xl shadow-2xl max-w-[500px] w-full mx-auto">
            
            <div class="text-center p-5 bg-indigo-500/10 rounded-2xl mb-5">
              <div class="text-6xl mb-2">{{ isCorrect ? '🎉' : '😔' }}</div>
              <h3 :class="['m-0 mb-2 text-2xl font-bold', isCorrect ? 'text-green-500' : 'text-red-500']">
                {{ isCorrect ? 'Brawo! +' + earnedPoints + ' pkt' : 'Nieudana próba' }}
              </h3>
              <p class="text-xl font-semibold text-indigo-500 m-0">
                Twój wynik: {{ myPlayer?.score }} pkt
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <button 
                v-if="!isReady"
                @click="sendReady"
                class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-2xl text-lg font-semibold shadow-lg shadow-indigo-500/40"
              >
                {{ (gameState.round === gameState.totalRounds && gameState.questionIndex === gameState.totalQuestions) ? 'Przejdź do rankingu' : 'GOTOWY' }}
              </button>
              <p v-else class="text-gray-400 italic text-center m-0">
                Oczekiwanie...
              </p>

              <button 
                @click="showDistribution = true"
                class="w-full py-3 bg-white text-indigo-500 border-2 border-indigo-500 rounded-2xl text-base font-semibold cursor-pointer"
              >
                Zobacz odpowiedzi graczy
              </button>
            </div>
          </div>
        </div>

        <!-- Distribution Screen -->
        <div v-else class="flex-1 flex flex-col p-5 pt-8 overflow-y-auto">
          <div class="bg-white/95 p-5 rounded-2xl shadow-2xl mb-auto">
            
            <div class="flex justify-between items-center mb-5">
              <h2 class="text-indigo-500 text-2xl m-0 font-semibold">Odpowiedzi</h2>
              <button 
                @click="showDistribution = false"
                class="bg-transparent border-none text-3xl text-gray-400 cursor-pointer p-0 leading-none"
              >
                ×
              </button>
            </div>

            <div class="flex flex-col gap-3">
              <div v-for="(ans, idx) in gameState.currentQuestion.answers" :key="idx"
                   :class="[
                     'p-3 rounded-xl border-2',
                     idx === correctAnswerIndex ? 'bg-green-500/15 border-green-500' : (idx === selectedAnswer ? 'bg-white border-indigo-500' : 'bg-white border-gray-200')
                   ]">
                 <div class="text-base mb-1 font-medium flex items-center gap-2">
                    <span>{{ ans }}</span>
                    <span v-if="idx === correctAnswerIndex" class="text-green-500 text-xl">✓</span>
                 </div>
                 
                 <div v-if="answerDistribution && answerDistribution[idx] && answerDistribution[idx].players.length > 0" 
                      class="flex flex-wrap gap-1.5 mt-2">
                    <span v-for="player in answerDistribution[idx].players" :key="player.id"
                          class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2 py-1 rounded-xl text-xs inline-flex items-center gap-1 font-medium">
                       <span>👤</span>
                       <span>{{ player.name }}</span>
                    </span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- RANKING -->
       <div v-else-if="gameState.status === 'ranking' || gameState.status === 'game_over'" class="flex items-center justify-center min-h-svh p-5">
          <div class="bg-white/95 px-8 py-10 rounded-3xl shadow-2xl text-center max-w-[500px] w-full">
            <div class="text-6xl mb-4">{{ gameState.status === 'game_over' ? '🏆' : '📊' }}</div>
            <h2 class="text-indigo-500 text-3xl m-0 mb-2 font-bold">{{ gameState.status === 'game_over' ? 'Koniec Gry! 🎮' : 'Koniec Rundy ' + gameState.round }}</h2>
            <h3 class="text-gray-600 text-lg m-0 mb-2 font-normal">{{ gameState.status === 'game_over' ? 'Ukończono wszystkie 3 rundy!' : 'Ranking po rundzie ' + gameState.round }}</h3>
            <h3 class="text-gray-500 text-base m-0 mb-6 font-semibold">Ranking {{ gameState.status === 'game_over' ? 'Końcowy' : '' }}</h3>
            
            <div class="bg-white p-4 rounded-2xl shadow-sm mb-6 max-h-[50vh] overflow-y-auto">
              <div v-for="(player, index) in gameState.players" :key="player.id" 
                   :class="[
                     'flex justify-between items-center p-3 rounded-xl mb-1.5',
                     player.id === myPlayerId ? 'bg-gradient-to-r from-indigo-500/20 to-purple-600/20 font-bold' : 'bg-gray-50 font-normal'
                   ]">
                <div class="flex items-center gap-2">
                  <span class="text-2xl min-w-[25px]">{{ index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : '')) }}</span>
                  <span class="text-base text-gray-800">{{ player.name }}</span>
                </div>
                <span class="text-xl text-indigo-500 font-semibold">{{ player.score }}</span>
              </div>
            </div>
            
            <div v-if="gameState.status === 'ranking' && gameState.round < gameState.totalRounds">
               <button 
                 v-if="!isReady"
                 @click="sendReady"
                 class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-2xl text-lg font-semibold shadow-lg shadow-indigo-500/40"
               >
                 GOTOWY NA RUNDĘ {{ gameState.round + 1 }}
               </button>
               <p v-else class="text-gray-400 italic">
                 Oczekiwanie...
               </p>
            </div>
            <div v-else-if="gameState.status === 'game_over'">
               <button 
                 @click="returnToJoin"
                 class="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white border-none rounded-2xl text-lg font-semibold shadow-lg shadow-green-500/40"
               >
                 Dołącz do kolejnej gry
               </button>
            </div>
          </div>
       </div>

      <!-- OTHER STATES -->
      <div v-else class="flex items-center justify-center min-h-svh p-5">
        <div class="bg-white/95 px-9 py-9 rounded-3xl shadow-2xl text-center">
          <h2 class="text-indigo-500 m-0">Oczekiwanie...</h2>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { $socket } = useNuxtApp()
const route = useRoute()

const isConnected = ref(false)
const joinedGame = ref(false)
const joinedGameId = ref('')
const inputGameCode = ref('')
const error = ref('')

const gameState = ref(null)
const myPlayerId = useCookie('playerId')
const myPlayer = computed(() => gameState.value?.players.find(p => p.id === myPlayerId.value))

const selectedVote = ref(null)
const selectedAnswer = ref(null)

// Question state
const revealed = ref(false)
const correctAnswerIndex = ref(-1)
const answerDistribution = ref(null)
const previousScore = ref(0)
const timerProgress = ref(100)
const votingTimerProgress = ref(100)
const showDistribution = ref(false)
let timerInterval = null
let votingTimerInterval = null

const isCorrect = computed(() => {
  return selectedAnswer.value === correctAnswerIndex.value
})

const earnedPoints = computed(() => {
  if (!myPlayer.value) return 0
  return Math.max(0, myPlayer.value.score - previousScore.value)
})

onMounted(() => {
  $socket.on('connect', () => {
    isConnected.value = true
    checkAutoJoin()
  })

  $socket.on('disconnect', () => {
      isConnected.value = false
      joinedGame.value = false
  })
  
  $socket.on('game-state', (state) => {
    // Detect phase changes to reset state
    if (gameState.value?.status !== state.status) {
       if (state.status === 'question') {
          // New question started
          resetQuestionState()
          startTimer(state.questionStartTime)
          stopVotingTimer()
       } else if (state.status === 'voting') {
          selectedVote.value = null
          startVotingTimer()
       } else if (state.status === 'round_intro') {
          stopVotingTimer()
       } else if (state.status === 'ranking') {
          isReady.value = false
          stopTimer()
          stopVotingTimer()
       } else {
          stopTimer()
          stopVotingTimer()
       }
    }
    
    // Detect question change within question status
    if (state.status === 'question' && gameState.value?.currentQuestion?.question !== state.currentQuestion?.question) {
       resetQuestionState()
       startTimer(state.questionStartTime)
    }

    gameState.value = state
    
    // Update joinedGameId to ensure it's current
    if (state.gameId) {
      joinedGameId.value = state.gameId
    }
    
    error.value = '' // Clear error on successful state update
  })
  
  $socket.on('question-timeout', ({ correctAnswerIndex: idx, answerDistribution: distribution }) => {
     revealed.value = true
     correctAnswerIndex.value = idx
     answerDistribution.value = distribution
     stopTimer()
  })
  
  $socket.on('player-joined', (player) => {
      // Check validation by socket ID since we might require a new ID assignment
      if (player.socketId === $socket.id) {
          joinedGame.value = true
          // Save valid player ID for future
          myPlayerId.value = player.id
          
          // Determine game ID
          joinedGameId.value = route.query.gameId || inputGameCode.value
      }
  })

  $socket.on('error', (msg) => {
      error.value = msg
      console.error(msg)
      // Reset join state on error
      joinedGame.value = false
  })

  // Initial check
  if ($socket.connected) {
    isConnected.value = true
    checkAutoJoin()
  }
})

function checkAutoJoin() {
    const urlGameId = route.query.gameId
    if (urlGameId && typeof urlGameId === 'string') {
        // Pre-fill input for clarity (optional, but good UX)
        inputGameCode.value = urlGameId
        joinGame(urlGameId)
    }
}

function joinGameManual() {
    if (!inputGameCode.value) return
    joinGame(inputGameCode.value.toUpperCase())
}

function joinGame(gameId) {
    error.value = ''
    joinedGameId.value = gameId
    $socket.emit('join-game', { playerId: myPlayerId.value, gameId })
}

function startTimer(startTime) {
  stopTimer()
  if (!startTime) return
  
  timerInterval = setInterval(() => {
     const now = Date.now()
     const elapsed = (now - startTime) / 1000
     const duration = 10
     const percent = Math.max(0, 100 - (elapsed / duration * 100))
     timerProgress.value = percent
     
     if (percent <= 0) stopTimer()
  }, 100)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

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

// Readiness
const isReady = ref(false)

function sendReady() {
  isReady.value = true
  $socket.emit('player-ready')
}

// Reset readiness when new question starts
function resetQuestionState() {
  selectedAnswer.value = null
  revealed.value = false
  correctAnswerIndex.value = -1
  answerDistribution.value = null
  timerProgress.value = 100
  isReady.value = false
  showDistribution.value = false
  previousScore.value = myPlayer.value?.score ?? 0
}

function vote(category) {
  selectedVote.value = category
  $socket.emit('submit-vote', { category })
}

function submitAnswer(index) {
  if (selectedAnswer.value !== null) return
  selectedAnswer.value = index
  $socket.emit('submit-answer', { answerIndex: index })
}

function returnToJoin() {
  // Reset state to return to join screen
  joinedGame.value = false
  joinedGameId.value = ''
  gameState.value = null
  inputGameCode.value = ''
  error.value = ''
}
</script>
