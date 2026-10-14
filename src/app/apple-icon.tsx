import { ImageResponse } from 'next/og'

/**
 * Apple touch icon dimensions in pixels.
 * Used by iOS devices when users add the site to their home screen.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */
export const size = {
  /** Icon width in pixels */
  width: 180,
  /** Icon height in pixels */
  height: 180,
}

/**
 * MIME type for the generated Apple touch icon.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */
export const contentType = 'image/png'

/**
 * Apple icon component - minimal dark design matching Geist aesthetic
 * @returns ImageResponse containing the apple icon
 */
export default function AppleIcon() {
  return new ImageResponse(
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
    </div>,
    {
      ...size,
    }
  )
}
