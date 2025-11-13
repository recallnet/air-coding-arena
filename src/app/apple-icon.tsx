import { ImageResponse } from 'next/og'

// Apple touch icon size (iOS home screen)
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

/**
 * Apple icon component - minimal dark design matching Geist aesthetic
 * @returns ImageResponse containing the apple icon
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
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
