import { io } from 'socket.io-client'

export default defineNuxtPlugin(() => {
  const socket = io()

  socket.on('connect', () => {
    console.log('Socket connected', socket.id)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  return {
    provide: {
      socket
    }
  }
})
