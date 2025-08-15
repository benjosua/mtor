import {
  defineConfig
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0,
      resizeOptions: { fit: 'cover' }
    },
    maskable: {
      sizes: [512],
      padding: 0.15,
      resizeOptions: {
        fit: 'contain',
        background: 'transparent'
      }
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: {
        fit: 'cover',
        background: 'transparent'
      }
    }
  },
  images: ['public/logo.png']
})