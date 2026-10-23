export const categories = [
  { id: 'all', title: 'Tudo', icon: '🌍' },
  { id: 'homes', title: 'Casas', icon: '🏡' },
  { id: 'experiences', title: 'Experiências', icon: '🎈' },
  { id: 'services', title: 'Serviços', icon: '🛎️' },
] as const

export type Category = (typeof categories)[number]['id']

export interface StaySection {
  id: string
  title: string
  ids: string[]
}

export interface Stay {
  id: string
  location: string
  title: string
  category: string
  distance: string
  dates: string
  price: number
  rating: string
  reviews: number
  image: string
  host: string
  initials: string
  guests: number
  description: string
  cardTitle?: string
  nights?: number
}

const asset = (name: string) => `~/airbnb/assets/${name}.jpg`
export const interior = asset('interior')
function sampleStay(
  stay: Pick<Stay, 'id' | 'location' | 'title' | 'cardTitle' | 'image' | 'price'> &
    Partial<Stay>,
): Stay {
  return {
    category: 'city',
    distance: '',
    dates: '13–15 de nov.',
    nights: 2,
    rating: '4,98',
    reviews: 64,
    host: 'Marina',
    initials: 'MA',
    guests: 4,
    description: 'Acomodação inteira com cozinha equipada, Wi-Fi e estacionamento.',
    ...stay,
  }
}

export const stays: Stay[] = [
  {
    id: 'serra',
    location: 'Gonçalves, Minas Gerais',
    title: 'Chalé com vista para as montanhas',
    category: 'cabin',
    distance: 'A 152 km de distância',
    dates: '6–11 de nov.',
    price: 680,
    rating: '4,98',
    reviews: 128,
    image: asset('cabin'),
    host: 'Marina',
    initials: 'MA',
    guests: 2,
    description:
      'Chalé para duas pessoas em Gonçalves, com vista para as montanhas, cozinha equipada e Wi-Fi.',
  },
  {
    id: 'brisa',
    location: 'Ubatuba, São Paulo',
    title: 'Casa com piscina em Ubatuba',
    category: 'beach',
    distance: 'A 198 km de distância',
    dates: '13–18 de nov.',
    price: 920,
    rating: '4,96',
    reviews: 86,
    image: asset('beach'),
    host: 'Pedro',
    initials: 'PE',
    guests: 6,
    description:
      'Casa para seis pessoas em Ubatuba, com piscina privativa e cozinha equipada, a poucos minutos da praia.',
  },
  {
    id: 'bosque',
    location: 'Campos do Jordão, São Paulo',
    title: 'Chalé em Campos do Jordão',
    category: 'cabin',
    distance: 'A 173 km de distância',
    dates: '20–25 de nov.',
    price: 540,
    rating: '4,92',
    reviews: 203,
    image: asset('mountain'),
    host: 'Clara',
    initials: 'CL',
    guests: 4,
    description:
      'Chalé para quatro pessoas em uma área arborizada de Campos do Jordão, com cozinha e estacionamento.',
  },
  {
    id: 'atelie',
    location: 'São Paulo, São Paulo',
    title: 'Apartamento em São Paulo',
    category: 'city',
    distance: 'A 5 km de distância',
    dates: '6–11 de nov.',
    price: 390,
    rating: '4,95',
    reviews: 64,
    image: asset('loft'),
    host: 'Lucas',
    initials: 'LU',
    guests: 2,
    description:
      'Apartamento para duas pessoas em São Paulo, com cozinha equipada e acesso a cafés e galerias da região.',
  },
  {
    id: 'solar',
    location: 'Paraty, Rio de Janeiro',
    title: 'Casa com piscina em Paraty',
    category: 'pool',
    distance: 'A 268 km de distância',
    dates: '13–18 de nov.',
    price: 780,
    rating: '4,99',
    reviews: 112,
    image: asset('pool'),
    host: 'Ana',
    initials: 'AN',
    guests: 4,
    description:
      'Casa para quatro pessoas em Paraty, com piscina e área externa. Próxima às praias e ao centro histórico.',
  },
  sampleStay({
    id: 'tortuga',
    location: 'Guarujá, São Paulo',
    title: 'Casa com piscina em Tortuga',
    cardTitle: 'Casa em Tortuga',
    image: asset('garden-house'),
    price: 1180,
    category: 'beach',
    rating: '4,88',
    guests: 8,
  }),
  sampleStay({
    id: 'virginia',
    location: 'Guarujá, São Paulo',
    title: 'Casa no Jardim Virgínia',
    cardTitle: 'Casa em Jardim Virgínia',
    image: asset('beach'),
    price: 1240,
    category: 'beach',
    rating: '4,90',
    dates: '12–14 de fev.',
    guests: 6,
  }),
  sampleStay({
    id: 'enseada',
    location: 'Guarujá, São Paulo',
    title: 'Sol e piscina na Enseada',
    cardTitle: 'Casa na Enseada',
    image: asset('pool'),
    price: 960,
    category: 'pool',
    guests: 6,
  }),
  sampleStay({
    id: 'campo-belo',
    location: 'São Paulo, São Paulo',
    title: 'Apartamento em Campo Belo',
    cardTitle: 'Apartamento em Campo Belo',
    image: asset('bedroom'),
    price: 266,
    rating: '5,0',
    guests: 2,
  }),
  sampleStay({
    id: 'consolacao',
    location: 'São Paulo, São Paulo',
    title: 'Apartamento na Consolação',
    cardTitle: 'Apartamento na Consolação',
    image: interior,
    price: 458,
    rating: '5,0',
    dates: '18–20 de dez.',
    guests: 2,
  }),
  sampleStay({
    id: 'sunset',
    location: 'São Francisco, Califórnia',
    title: 'Casa no Sunset District',
    cardTitle: 'Casa no Sunset District',
    image: asset('city-house'),
    price: 840,
    rating: '4,97',
  }),
  sampleStay({
    id: 'mission',
    location: 'São Francisco, Califórnia',
    title: 'Apartamento no Mission District',
    cardTitle: 'Apartamento no Mission',
    image: asset('loft'),
    price: 690,
    rating: '4,95',
  }),
  sampleStay({
    id: 'noe-valley',
    location: 'São Francisco, Califórnia',
    title: 'Apartamento em Noe Valley',
    cardTitle: 'Apartamento em Noe Valley',
    image: interior,
    price: 740,
    rating: '4,99',
  }),
]

export const staySections: StaySection[] = [
  { id: 'guaruja', title: 'Fique em Guarujá', ids: ['tortuga', 'virginia', 'enseada'] },
  {
    id: 'sao-paulo',
    title: 'Acomodações em São Paulo',
    ids: ['campo-belo', 'consolacao', 'atelie'],
  },
  {
    id: 'san-francisco',
    title: 'Acomodações em São Francisco',
    ids: ['sunset', 'mission', 'noe-valley'],
  },
  {
    id: 'natureza',
    title: 'Acomodações perto da natureza',
    ids: ['serra', 'bosque', 'brisa', 'solar'],
  },
]
