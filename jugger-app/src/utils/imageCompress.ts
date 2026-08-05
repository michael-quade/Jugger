export async function compressImage(file: File, maxSizeKB = 500, maxDim = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else                { width = Math.round(width * maxDim / height);  height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      let quality = 0.85
      const attempt = () => canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return }
        if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) resolve(blob)
        else { quality -= 0.1; attempt() }
      }, 'image/jpeg', quality)
      attempt()
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
