export interface Article {
  slug: string
  title: string
  date: string
  desc: string
  body: string
}

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }
  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':')
    if (sep > 0) data[line.slice(0, sep).trim()] = line.slice(sep + 1).trim()
  }
  return { data, content: match[2] }
}

const mdFiles = import.meta.glob('/src/content/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function getAllArticles(): Article[] {
  const articles: Article[] = []
  for (const [path, raw] of Object.entries(mdFiles)) {
    const { data, content } = parseFrontmatter(raw)
    const slug = path.split('/').pop()?.replace(/\.md$/, '') || ''
    articles.push({
      slug: slug || data.slug || '',
      title: data.title || slug,
      date: data.date || '',
      desc: data.desc || '',
      body: content,
    })
  }
  articles.sort((a, b) => b.date.localeCompare(a.date))
  return articles
}

export function getArticleBySlug(slug: string): Article | undefined {
  for (const [path, raw] of Object.entries(mdFiles)) {
    const fileSlug = path.split('/').pop()?.replace(/\.md$/, '')
    if (fileSlug === slug) {
      const { data, content } = parseFrontmatter(raw)
      return {
        slug,
        title: data.title || slug,
        date: data.date || '',
        desc: data.desc || '',
        body: content,
      }
    }
  }
}
