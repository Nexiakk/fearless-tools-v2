<template>
  <div
    v-if="drawingStore.isAdmin || drawingStore.strokes.length > 0"
    class="drawing-canvas-container"
    :class="{ 'drawing-active': drawingStore.isDrawingModeActive }"
  >
    <!-- Drawing Controls (Admin Only) -->
    <div v-if="drawingStore.isAdmin" class="drawing-controls">
      <button
        @click="drawingStore.toggleDrawingMode()"
        :class="[
          'drawing-toggle-button',
          drawingStore.isDrawingModeActive ? 'active' : ''
        ]"
        :title="drawingStore.isDrawingModeActive ? 'Disable Drawing Mode (D)' : 'Enable Drawing Mode (D)'"
      >
        <svg v-if="!drawingStore.isDrawingModeActive" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        {{ drawingStore.isDrawingModeActive ? 'Drawing ON' : 'Drawing OFF' }}
      </button>

      <div v-if="drawingStore.isDrawingModeActive" class="drawing-tools">
        <!-- Color Picker -->
        <div class="drawing-tool-group">
          <label class="drawing-tool-label">Color:</label>
          <input
            type="color"
            v-model="drawingStore.color"
            @input="drawingStore.setColor($event.target.value)"
            class="drawing-color-picker"
          />
        </div>

        <!-- Brush Size -->
        <div class="drawing-tool-group">
          <label class="drawing-tool-label">Size:</label>
          <input
            type="range"
            :min="1"
            :max="20"
            :value="drawingStore.brushWidth"
            @input="drawingStore.setBrushWidth(parseInt($event.target.value))"
            class="drawing-brush-slider"
          />
          <span class="drawing-brush-size">{{ drawingStore.brushWidth }}px</span>
        </div>

        <!-- Clear Button -->
        <button
          @click="handleClearCanvas"
          class="drawing-clear-button"
          title="Clear All Drawings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear
        </button>
      </div>
    </div>

    <!-- Canvas -->
    <canvas
      ref="canvasRef"
      class="drawing-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDrawingStore } from '@/stores/drawing'
import { useConfirmationStore } from '@/stores/confirmation'

const drawingStore = useDrawingStore()
const confirmationStore = useConfirmationStore()
const canvasRef = ref(null)
let ctx = null
let isDrawing = false

// Initialize canvas
onMounted(async () => {
  await nextTick()
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    resizeCanvas()
    await drawingStore.loadStrokes()
    drawingStore.setupRealtimeSync()
    renderAllStrokes()
    
    // Keyboard shortcut: 'D' to toggle drawing mode
    window.addEventListener('keydown', handleKeyDown)
    
    // Resize on window resize
    window.addEventListener('resize', resizeCanvas)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', resizeCanvas)
  drawingStore.cleanup()
})

// Watch for new strokes from real-time sync
watch(() => drawingStore.strokes.length, () => {
  renderAllStrokes()
})

// Watch for current stroke changes
watch(() => drawingStore.currentStroke, (newStroke) => {
  if (newStroke) {
    renderStroke(newStroke)
  }
}, { deep: true })

function resizeCanvas() {
  if (!canvasRef.value) return
  
  const container = canvasRef.value.parentElement
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  canvasRef.value.width = rect.width
  canvasRef.value.height = rect.height
  
  // Re-render all strokes after resize
  renderAllStrokes()
}

function getCanvasPoint(e) {
  if (!canvasRef.value) return null
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - rect.left
  const y = (e.clientY || (e.touches && e.touches[0]?.clientY) || 0) - rect.top
  
  return { x, y }
}

function handleMouseDown(e) {
  if (!drawingStore.canDraw) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (point) {
    drawingStore.startStroke(point)
    isDrawing = true
  }
}

function handleMouseMove(e) {
  if (!drawingStore.canDraw || !isDrawing) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (point) {
    drawingStore.addPointToStroke(point)
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return
  e.preventDefault()
  isDrawing = false
  drawingStore.endStroke()
}

function handleMouseLeave(e) {
  if (isDrawing) {
    isDrawing = false
    drawingStore.endStroke()
  }
}

function handleTouchStart(e) {
  if (!drawingStore.canDraw) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (point) {
    drawingStore.startStroke(point)
    isDrawing = true
  }
}

function handleTouchMove(e) {
  if (!drawingStore.canDraw || !isDrawing) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (point) {
    drawingStore.addPointToStroke(point)
  }
}

function handleTouchEnd(e) {
  if (!isDrawing) return
  e.preventDefault()
  isDrawing = false
  drawingStore.endStroke()
}

function handleKeyDown(e) {
  // 'D' key to toggle drawing mode (only for admin)
  if (e.key === 'd' || e.key === 'D') {
    if (drawingStore.isAdmin && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      drawingStore.toggleDrawingMode()
    }
  }
}

function renderStroke(stroke) {
  if (!ctx || !stroke || !stroke.points || stroke.points.length < 2) return
  
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
  }
  
  ctx.stroke()
}

function renderAllStrokes() {
  if (!ctx || !canvasRef.value) return
  
  // Clear canvas
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  // Render all strokes
  drawingStore.strokes.forEach(stroke => {
    renderStroke(stroke)
  })
  
  // Render current stroke if exists
  if (drawingStore.currentStroke) {
    renderStroke(drawingStore.currentStroke)
  }
}

function handleClearCanvas() {
  confirmationStore.open({
    message: 'Are you sure you want to clear all drawings? This cannot be undone.',
    confirmAction: async () => {
      try {
        await drawingStore.clearCanvas()
      } catch (error) {
        console.error('Error clearing canvas:', error)
        alert('Failed to clear canvas.')
      }
    },
    isDanger: true
  })
}
</script>

<style scoped>
.drawing-canvas-container {
  position: fixed;
  top: 60px; /* Below navbar */
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 40;
}

.drawing-canvas-container.drawing-active {
  pointer-events: auto;
}

.drawing-controls {
  position: fixed;
  top: 80px;
  right: 20px;
  background: rgba(31, 41, 55, 0.95);
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  padding: 1rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
  pointer-events: auto;
}

.drawing-toggle-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #374151;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.drawing-toggle-button:hover {
  background: #4b5563;
}

.drawing-toggle-button.active {
  background: #3b82f6;
}

.drawing-toggle-button.active:hover {
  background: #2563eb;
}

.drawing-tools {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #4b5563;
}

.drawing-tool-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.drawing-tool-label {
  font-size: 0.875rem;
  color: #d1d5db;
  min-width: 50px;
}

.drawing-color-picker {
  width: 50px;
  height: 32px;
  border: 1px solid #4b5563;
  border-radius: 0.25rem;
  cursor: pointer;
  background: none;
  padding: 0;
}

.drawing-brush-slider {
  flex: 1;
  height: 4px;
  background: #4b5563;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.drawing-brush-size {
  font-size: 0.875rem;
  color: #d1d5db;
  min-width: 40px;
  text-align: right;
}

.drawing-clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.drawing-clear-button:hover {
  background: #dc2626;
}

.drawing-canvas {
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: crosshair;
}

.drawing-canvas-container:not(.drawing-active) .drawing-canvas {
  cursor: default;
  pointer-events: none;
}
</style>

