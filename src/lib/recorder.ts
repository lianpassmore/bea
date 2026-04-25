'use client'

/**
 * Records microphone audio as a 16-bit PCM WAV blob.
 * Uses Web Audio API (ScriptProcessorNode) so the WAV is ready for Azure
 * Speaker Recognition without any server-side conversion.
 */
export async function recordWav(
  durationMs: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: { ideal: 16_000 },
    },
  })

  // Request 16 kHz context; browser may honour this or fall back to system rate.
  // Either way we encode the actual rate in the WAV header.
  const ctx = new AudioContext({ sampleRate: 16_000 })
  const source = ctx.createMediaStreamSource(stream)
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  const startTime = Date.now()

  return new Promise<Blob>((resolve, reject) => {
    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      onProgress?.(Math.min(100, ((Date.now() - startTime) / durationMs) * 100))
    }

    source.connect(processor)
    processor.connect(ctx.destination)

    stream.getTracks()[0].addEventListener('ended', () => {
      reject(new Error('Microphone disconnected'))
    })

    setTimeout(() => {
      processor.disconnect()
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      ctx.close().then(() => {
        const totalLen = chunks.reduce((n, c) => n + c.length, 0)
        const pcm = new Float32Array(totalLen)
        let offset = 0
        for (const c of chunks) { pcm.set(c, offset); offset += c.length }
        resolve(encodeWav(pcm, ctx.sampleRate))
      })
    }, durationMs)
  })
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const int16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    int16[i] = s < 0 ? s * 32768 : s * 32767
  }

  const dataLen = int16.byteLength
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }

  str(0, 'RIFF');  v.setUint32(4, 36 + dataLen, true)
  str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true)             // PCM chunk size
  v.setUint16(20, 1, true)              // PCM format
  v.setUint16(22, 1, true)              // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true) // byte rate
  v.setUint16(32, 2, true)              // block align
  v.setUint16(34, 16, true)             // bits per sample
  str(36, 'data'); v.setUint32(40, dataLen, true)
  new Int16Array(buf, 44).set(int16)

  return new Blob([buf], { type: 'audio/wav' })
}
