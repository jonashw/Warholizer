// A few rows in the knowledge base's own shapes: a public work, an in-copyright work, an own work
// (a draft until Jon's editorial pass), a private work, and the tropes and idioms that point at them.
const work = (o: Record<string, unknown>) => ({
  title: null, who: null, when: null, form: 'picture', origin: 'received', recognition: 0,
  inCopyright: false, materials: null, image: null, excerpt: null, statement: null, proofs: null,
  arrangement: null, keys: null, ...o,
})
const reading = (o: Record<string, unknown>) => ({
  viewer: 'claude', canon: null, chain: null, archetype: null, recognition: 0, frameRead: null,
  meaning: null, note: null, ...o,
})

export const tables = {
  works: [
    work({ id: 'monalisa', title: 'Mona Lisa', who: 'Leonardo da Vinci, about 1503–1519', recognition: 4, image: 'Mona Lisa.jpg' }),
    work({ id: 'marilyn', title: 'Marilyn Diptych', who: 'Andy Warhol, 1962', inCopyright: true, image: 'Marilyn diptych.jpg' }),
    work({ id: 'glyphBands', who: 'Jon Wilson', origin: 'own', image: 'glyphBands-1.jpg', words: ['EYEYEYE'] }),
    work({ id: 'secret', title: 'Secret <b>', who: 'Jon Wilson', origin: 'own', private: true }),
  ],
  readings: [
    reading({ work: 'monalisa', canon: 'portrait', chain: 'portrait.setDegree(smiles, 1)', archetype: 'icon', meaning: 'trust 3', frameRead: { domains: ['folkEveryday'], stance: 'straight' } }),
    reading({ work: 'marilyn', chain: 'portrait.repeat(50)', archetype: 'icon' }),
    reading({ work: 'glyphBands', chain: 'bands of glyphs', jonSaid: 'swords and skulls are glyphs', open: ['title'] }),
  ],
  tropes: [
    { id: 'massProduction', name: 'Mass production', kind: 'trope', turn: 'condense', idea: 'Repetition drains the meaning.', carriedBy: ['repeat(n)'], conditions: { domain: 'pop' }, anchors: ['marilyn', 'glyphBands'], origin: 'received' },
    { id: 'defacement', name: 'Defacement', kind: 'trope', turn: 'flip', idea: 'A mark over a revered face.', carriedBy: ['setState(subject.face, blank)'], conditions: {}, anchors: ['monalisa', 'topBanana'], origin: 'received' },
  ],
  idioms: [
    { id: 'topBanana', phrase: 'top banana', kind: 'verbal', meaning: 'the boss', source: 'Merriam-Webster', history: 'vaudeville slang', origin: 'received', skeuomorph: false },
  ],
  techniques: [
    { id: 'lastNodeIsMeaning', name: 'The last node is the meaning', what: 'Put the key part last.', how: 'setAttention(keyPart, 1)', archetypes: ['icon'], anchors: ['monalisa'], origin: 'received' },
  ],
  archetypes: [
    { id: 'icon', name: 'Icon', example: 'soupCan.repeat(32)', recipe: 'One node, repeated.', anchors: ['monalisa', 'marilyn'] },
  ],
}
