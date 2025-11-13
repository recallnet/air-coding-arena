import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

/**
 * Icon component - minimal dark design matching Geist aesthetic
 * @returns ImageResponse containing the icon
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fafafa',
          fontWeight: 600,
          fontFamily: 'monospace',
          letterSpacing: '-0.05em',
        }}
      >
        {'</>'}
      </div>
    ),
    {
      ...size,
    }
  )
}
