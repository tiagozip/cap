export interface ShowcaseEntry {
  name: string
  logo: string
  url: string
}

const showcase: ShowcaseEntry[] = [
  {
    name: 'bunny.net',
    logo: '/logos/bunny.svg',
    url: 'https://bunny.net',
  },
  {
    name: 'AdGuard',
    logo: '/logos/adguard.svg',
    url: 'https://adguard.com',
  },
  {
    name: 'Fraunhofer',
    logo: '/logos/fraunhofer.svg',
    url: 'https://www.fraunhofer.de',
  },
]

export default showcase
