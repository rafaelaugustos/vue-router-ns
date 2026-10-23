import { stays, type Stay, type StaySection } from '../data'

export const money = (value: number) =>
  `R$ ${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
export const stayTotal = (stay: Stay) => money(stay.price * (stay.nights ?? 5))
export function matchingStays(query: string, maxPrice: number) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const term = normalize(query.trim())
  return stays.filter(
    (stay) =>
      stay.price <= maxPrice &&
      normalize(`${stay.location} ${stay.title}`).includes(term),
  )
}

export function staysForSection(section: StaySection, available: Stay[]): Stay[] {
  const byId = new Map(available.map((stay) => [stay.id, stay]))
  return section.ids.flatMap((id) => {
    const stay = byId.get(id)
    return stay ? [stay] : []
  })
}
