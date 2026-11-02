import type { SVGProps } from 'react'

/** Brand marks as plain SVG (lucide no longer ships logos). Decorative: labels live on the parent link/button. */
type IconProps = SVGProps<SVGSVGElement>
const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  width: 20,
  height: 20,
  'aria-hidden': true as const,
  focusable: false as const,
  ...props,
})

export const FacebookIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
  </svg>
)

export const InstagramIcon = (props: IconProps) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const TwitterIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor">
    <path d="M21.5 6.2c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.2 1.7-2.1-.8.5-1.6.8-2.5 1A3.9 3.9 0 0 0 11.8 9.3 11 11 0 0 1 3.8 5.2a3.9 3.9 0 0 0 1.2 5.2c-.6 0-1.2-.2-1.8-.5 0 1.9 1.4 3.5 3.1 3.8-.6.2-1.2.2-1.8.1a3.9 3.9 0 0 0 3.6 2.7A7.8 7.8 0 0 1 2.5 18a11 11 0 0 0 6 1.7c7.2 0 11.1-6 11.1-11.1v-.5c.8-.5 1.4-1.2 1.9-1.9z" />
  </svg>
)

export const LinkedinIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor">
    <path d="M5 8.5h3V19H5V8.5zM6.5 4a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5zM10.2 8.5h2.9v1.4c.4-.8 1.4-1.6 3-1.6 3.1 0 3.7 2 3.7 4.7V19h-3v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V19h-2.9V8.5z" />
  </svg>
)

export const YoutubeIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor">
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  </svg>
)

export const GoogleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z" />
  </svg>
)

export const FacebookBrandIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path
      fill="#3b5ec7"
      d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z"
    />
  </svg>
)

/** "Thank you" envelope from the order confirmation frame. */
export const ThankYouIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 72 84"
    width={72}
    height={84}
    aria-hidden
    focusable={false}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6 40 36 18l30 22v38H6V40z" />
    <path d="M6 78l24-22h12l24 22" />
    <path d="M6 40l22 18M66 40 44 58" />
    <rect x="14" y="6" width="44" height="34" rx="2" fill="var(--surface)" />
    <path d="M30 6c0-3 2.5-5 6-5s6 2 6 5" />
    <text
      x="36"
      y="21"
      textAnchor="middle"
      fontSize="11"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
      fontFamily="system-ui, sans-serif"
    >
      THANK
    </text>
    <text
      x="36"
      y="33"
      textAnchor="middle"
      fontSize="11"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
      fontFamily="system-ui, sans-serif"
    >
      YOU
    </text>
  </svg>
)
