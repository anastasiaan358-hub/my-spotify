export type FolkRegion = 'north' | 'europe' | 'caucasus' | 'africa' | 'asia' | 'americas'

export const folkRegionLabels: Record<FolkRegion, string> = {
  north: 'Север и финно-угорский мир',
  europe: 'Восточная и Западная Европа',
  caucasus: 'Кавказ и Центральная Азия',
  africa: 'Африка и Магриб',
  asia: 'Азия и Океания',
  americas: 'Америки',
}

export interface FolkTradition {
  id: string
  region: FolkRegion
  place: string
  title: string
  localName: string
  timeframe: string
  description: string
  forms: string[]
  instruments: string[]
  sourceLabel: string
  sourceUrl: string
  featured?: boolean
}

export interface FolkRoute {
  id: string
  number: string
  title: string
  caption: string
  traditionIds: string[]
}

export const folkTraditions: FolkTradition[] = [
  {
    id: 'karelian-runosong', region: 'north', place: 'Карелия / Ингрия / Финляндия', title: 'Карельская руническая песня', localName: 'runolaulu / runosong', timeframe: 'Архаическая устная традиция / записи XIX–XX веков', featured: true,
    description: 'Стих калевальского метра разворачивается в узком мелодическом диапазоне, через повтор, параллельное пение и импровизацию. Архив включает эпические руны, свадебные и погребальные плачи, детские и пастушеские напевы.',
    forms: ['руническая песня', 'причитание', 'пастушеский напев', 'инструментальная импровизация'], instruments: ['кантеле', 'йоухикко', 'голос'],
    sourceLabel: 'Digital Archive of Finnish Folk Tunes · 8613 мелодий', sourceUrl: 'https://esavelmat.jyu.fi/collection.html',
  },
  {
    id: 'seto-leelo', region: 'north', place: 'Сетумаа / Печорский район', title: 'Сетуский леэло', localName: 'Seto leelo', timeframe: 'Живая многоголосная традиция',
    description: 'Запевала предлагает строку, хор подхватывает последние слоги и повторяет фразу. Пение сопровождало повседневную работу и календарные события, а сегодня остаётся центром общинной идентичности.',
    forms: ['женское многоголосие', 'обрядовая песня', 'импровизация текста'], instruments: ['голоса', 'смычковая лира'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/seto-leelo-seto-polyphonic-singing-tradition-00173',
  },
  {
    id: 'russian-north', region: 'north', place: 'Архангельская / Вологодская земли / Поморье', title: 'Русский Север', localName: 'былина / протяжная песня', timeframe: 'Устная традиция / полевые записи XX века',
    description: 'Эпическое сказительство, протяжная песня, свадебные причитания и хороводные формы образуют разные исполнительские системы, связанные с речью, обрядом и локальным диалектом.',
    forms: ['былина', 'протяжная песня', 'причитание', 'хоровод'], instruments: ['голос', 'гусли', 'рожок'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'yakut-olonkho', region: 'north', place: 'Республика Саха (Якутия)', title: 'Якутский олонхо', localName: 'Olonkho', timeframe: 'Древняя эпическая традиция / записи XX века',
    description: 'Многочасовое эпическое повествование соединяет речевую декламацию, речитатив и контрастные голоса персонажей. Исполнитель одновременно выступает рассказчиком, певцом и актёром.',
    forms: ['эпос', 'речитатив', 'персонажное пение'], instruments: ['голос', 'хомус'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/olonkho-yakut-heroic-epos-00145',
  },
  {
    id: 'semeiskie', region: 'europe', place: 'Забайкалье', title: 'Пение семейских', localName: 'семейская протяжная', timeframe: 'XVIII–XX века / живая традиция',
    description: 'Старообрядческие общины сохраняют плотное многоголосие, длительное дыхание и локальный репертуар духовных стихов, календарных и семейных песен.',
    forms: ['многоголосная песня', 'духовный стих', 'календарный напев'], instruments: ['голоса'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/cultural-space-and-oral-culture-of-the-semeiskie-00017',
  },
  {
    id: 'ukrainian-kobzar', region: 'europe', place: 'Украина', title: 'Кобзарская традиция', localName: 'дума / kobzar tradition', timeframe: 'XVI–XX века / архивные записи',
    description: 'Думы исполняются как протяжный речитатив с формульной мелодикой. Кобзари и лирники передавали исторические, нравственные и религиозные сюжеты от учителя к ученику.',
    forms: ['дума', 'псальма', 'историческая песня'], instruments: ['кобза', 'бандура', 'колёсная лира'],
    sourceLabel: 'Smithsonian Folkways · World', sourceUrl: 'https://folkways.si.edu/world',
  },
  {
    id: 'belarus-polissya', region: 'europe', place: 'Белорусское Полесье', title: 'Полесский календарный цикл', localName: 'веснянки / жнивные / колядные', timeframe: 'Архаические пласты / записи XX века',
    description: 'Весенние заклички, жатвенные и зимние песни образуют годовой обрядовый круг. Тембр, унисон и гетерофония меняются вместе с функцией песни и местом исполнения.',
    forms: ['веснянка', 'жатвенная песня', 'колядная песня'], instruments: ['голоса', 'дудка', 'скрипка'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'bulgarian-shopluk', region: 'europe', place: 'Шоплук / Болгария', title: 'Болгарская архаическая полифония', localName: 'Bistritsa Babi', timeframe: 'Живая обрядовая традиция',
    description: 'Женские партии образуют плотные секундовые созвучия и устойчивый бурдон; пение связано с танцем хоро и календарными ритуалами региона Шоплук.',
    forms: ['диафония', 'бурдонное пение', 'обрядовый танец'], instruments: ['голоса', 'гайда', 'кавал'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/bistritsa-babi-archaic-polyphony-dances-and-rituals-from-the-shoplouk-region-00095',
  },
  {
    id: 'georgian-polyphony', region: 'caucasus', place: 'Грузия / Сванети / Кахетия / Гурия', title: 'Грузинское многоголосие', localName: 'Chakrulo / krimanchuli', timeframe: 'Средневековые корни / живая традиция',
    description: 'Региональные системы включают сванскую комплексную полифонию, кахетинский диалог над басом и западногрузинские импровизационные партии с высоким криманчули.',
    forms: ['застольная песня', 'трудовая песня', 'полифонический диалог'], instruments: ['голоса', 'пандури', 'чонгури'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/georgian-polyphonic-singing-00008',
  },
  {
    id: 'armenian-duduk', region: 'caucasus', place: 'Армения', title: 'Армянский дудук', localName: 'duduk / tsiranapogh', timeframe: 'Традиция с древними корнями / записи XX века',
    description: 'Парное исполнение соединяет ведущую мелодию и непрерывный дам: один музыкант артикулирует напев, второй удерживает бурдон с помощью цепного дыхания.',
    forms: ['инструментальный напев', 'танцевальная мелодия', 'плач'], instruments: ['дудук', 'дхол'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/duduk-and-its-music-00092',
  },
  {
    id: 'azerbaijani-mugham', region: 'caucasus', place: 'Азербайджан', title: 'Азербайджанский мугам', localName: 'muğam', timeframe: 'Классическая устная традиция / записи XX века',
    description: 'Модальная композиция создаётся в исполнении: певец-ханенде и инструменталисты разворачивают последовательность разделов, импровизируя внутри устойчивой ладовой модели.',
    forms: ['дастгях', 'тесниф', 'ренг'], instruments: ['тар', 'кяманча', 'гавал', 'голос'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/azerbaijani-mugham-00039',
  },
  {
    id: 'kazakh-kui', region: 'caucasus', place: 'Казахстан', title: 'Казахский кюй', localName: 'домбыра күйі / dombra kuy', timeframe: 'Устная инструментальная школа',
    description: 'Короткая программная пьеса передаёт рассказ без слов. Западные токпе-кюи тяготеют к энергичному движению, восточные шертпе-кюи — к камерной повествовательности.',
    forms: ['токпе-кюй', 'шертпе-кюй', 'инструментальный рассказ'], instruments: ['домбра', 'кобыз'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/art-of-dombra-kuy-00996',
  },
  {
    id: 'kyrgyz-manas', region: 'caucasus', place: 'Кыргызстан', title: 'Эпос «Манас»', localName: 'Манас / Семетей / Сейтек', timeframe: 'Устная эпическая традиция',
    description: 'Манасчи исполняет огромный повествовательный цикл без фиксированной партитуры, меняя тембр, ритм речи и мелодическую формулу в зависимости от сцены.',
    forms: ['эпическая декламация', 'речитатив', 'импровизация'], instruments: ['голос', 'комуз', 'кыл-кыяк'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/kyrgyz-epic-trilogy-manas-semetey-seytek-00876',
  },
  {
    id: 'mongolian-khoomei', region: 'caucasus', place: 'Западная Монголия / Алтай', title: 'Монгольский хөөмий', localName: 'khöömii', timeframe: 'Кочевая пастушеская традиция',
    description: 'Певец удерживает основной бурдон и формирует над ним слышимую мелодию обертонов. Основные группы техник включают глубокий хархираа и высокий свистящий исгэрээ.',
    forms: ['обертоновое пение', 'хархираа', 'исгэрээ'], instruments: ['голос', 'морин хуур', 'товшуур'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/mongolian-traditional-art-of-khoomei-00396',
  },
  {
    id: 'west-african-griot', region: 'africa', place: 'Мали / Сенегал / Гвинея / Гамбия', title: 'Западноафриканская гриотская традиция', localName: 'jeli / jali', timeframe: 'Наследственная устная профессия',
    description: 'Исполнитель хранит генеалогии, исторические рассказы и похвальные песни. Музыка строится на циклических инструментальных моделях, поверх которых разворачивается текст.',
    forms: ['эпос', 'похвальная песня', 'генеалогический рассказ'], instruments: ['кора', 'балафон', 'нгони'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'aka-polyphony', region: 'africa', place: 'Центральноафриканская Республика', title: 'Полифония ака', localName: 'Aka vocal polyphony', timeframe: 'Живая общинная традиция',
    description: 'Независимые голосовые формулы, йодль и ритмическая плотность складываются без дирижёра. Пение связано с охотой, танцем, лечением и общественными событиями.',
    forms: ['полифония', 'йодль', 'ритмический канон'], instruments: ['голоса', 'хлопки', 'барабаны'],
    sourceLabel: 'Smithsonian Folkways · Aka Pygmy Music', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'gnawa', region: 'africa', place: 'Марокко', title: 'Музыка гнауа', localName: 'Gnawa', timeframe: 'Ритуальная и городская традиция',
    description: 'Ночные церемонии соединяют призывные песни, металлический пульс кракебов и низкий рисунок гиембри. Репертуар хранит память о транссахарской истории общин.',
    forms: ['lila', 'призывная песня', 'трансовый цикл'], instruments: ['гимбри', 'кракебы', 'тбель'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/gnawa-01170',
  },
  {
    id: 'ethiopian-azmari', region: 'africa', place: 'Эфиопия', title: 'Эфиопские азмари', localName: 'azmari / tizita', timeframe: 'Профессиональная устная традиция',
    description: 'Певцы создают стихи для конкретной ситуации, комментируют события и взаимодействуют с аудиторией. Мелодии опираются на ладовые модели кэнэт.',
    forms: ['импровизированная песня', 'похвала', 'сатирический комментарий'], instruments: ['масинко', 'крар', 'кэбэро'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'bengal-baul', region: 'asia', place: 'Бангладеш / Западная Бенгалия', title: 'Песни баулов', localName: 'Baul gaan', timeframe: 'Странствующая духовная традиция',
    description: 'Песни соединяют телесную метафорику, духовный поиск и простые повторяющиеся мелодии. Исполнитель часто сам аккомпанирует себе и передаёт репертуар устно.',
    forms: ['духовная песня', 'странствующее пение', 'импровизация'], instruments: ['эктара', 'дотара', 'кхамак'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/baul-songs-00107',
  },
  {
    id: 'indonesian-gamelan', region: 'asia', place: 'Ява / Бали / Индонезия', title: 'Гамелан', localName: 'gamelan', timeframe: 'Дворцовые, деревенские и театральные традиции',
    description: 'Ансамбль мыслится как единый инструмент: гонговые циклы организуют время, металлофоны развивают основную мелодию, а быстрые партии переплетаются в плотную ткань.',
    forms: ['гонговый цикл', 'театральная музыка', 'танцевальное сопровождение'], instruments: ['гонги', 'металлофоны', 'кенданг', 'ребаб'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/gamelan-01607',
  },
  {
    id: 'japanese-minyo', region: 'asia', place: 'Япония', title: 'Японская народная песня', localName: '民謡 / min’yō', timeframe: 'Региональные трудовые и праздничные песни',
    description: 'Название объединяет локальные песни труда, танца, праздника и пути. Ритм и состав зависят от контекста: от свободного сольного напева до ансамбля фестиваля.',
    forms: ['трудовая песня', 'праздничная песня', 'танец бон'], instruments: ['сямисэн', 'сякухати', 'тайко', 'голос'],
    sourceLabel: 'Smithsonian Folkways · World', sourceUrl: 'https://folkways.si.edu/world',
  },
  {
    id: 'aboriginal-song', region: 'asia', place: 'Австралия', title: 'Песенные традиции аборигенов Австралии', localName: 'song traditions / songlines', timeframe: 'Древние живые традиции',
    description: 'Песни связаны с языком, местностью, родством и церемонией. Формы различаются между общинами; архивная карточка не заменяет контекст и права носителей традиции.',
    forms: ['церемониальная песня', 'песенный маршрут', 'танцевальный цикл'], instruments: ['голос', 'хлопушки', 'диджериду'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'inuit-katajjaq', region: 'americas', place: 'Арктическая Канада / Гренландия', title: 'Инуитские игровые песни', localName: 'katajjaq / throat games', timeframe: 'Живая женская игровая традиция',
    description: 'Две исполнительницы стоят лицом друг к другу и чередуют короткие дыхательные формулы; проигрывает та, которая первой сбивается или смеётся.',
    forms: ['горловая игра', 'барабанная песня', 'колыбельная'], instruments: ['голоса', 'рамочный барабан'],
    sourceLabel: 'Smithsonian Folkways · Inuit Games and Songs', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'appalachian-old-time', region: 'americas', place: 'Аппалачи / США', title: 'Аппалачская баллада и old-time', localName: 'ballad / old-time', timeframe: 'XVIII–XX века / полевые записи',
    description: 'Британские и ирландские балладные сюжеты встретились с афроамериканскими инструментальными практиками. Запись зафиксировала множество локальных вариантов текста и мелодии.',
    forms: ['баллада', 'скрипичный наигрыш', 'танцевальная песня'], instruments: ['скрипка', 'банджо', 'дульцимер'],
    sourceLabel: 'Library of Congress · American Folklife Center', sourceUrl: 'https://www.loc.gov/collections/traditional-music-and-spoken-word/about-this-collection/',
  },
  {
    id: 'andean-music', region: 'americas', place: 'Перу / Боливия / Эквадор', title: 'Андские общинные ансамбли', localName: 'siku / huayno', timeframe: 'Доколониальные основы / современные общины',
    description: 'Парные ряды флейт делят мелодию между музыкантами, поэтому музыкальная линия существует только в коллективном исполнении. Танец и календарь определяют состав ансамбля.',
    forms: ['сикури', 'уайно', 'карнавальный цикл'], instruments: ['сику', 'кена', 'чаранго', 'бомбо'],
    sourceLabel: 'Smithsonian Folkways · UNESCO Collection', sourceUrl: 'https://folkways.si.edu/unesco',
  },
  {
    id: 'cuban-rumba', region: 'americas', place: 'Куба', title: 'Кубинская румба', localName: 'yambú / guaguancó / columbia', timeframe: 'XIX–XX века / городская общинная традиция',
    description: 'Пение с ответом хора, клаве, барабанный диалог и танец образуют единое событие. Три основные формы различаются темпом, движением и отношением солиста к ансамблю.',
    forms: ['ямбу', 'гуагуанко', 'колумбия'], instruments: ['конги', 'клаве', 'кахон', 'голоса'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/rumba-in-cuba-a-festive-combination-of-dance-and-music-and-all-the-cultural-practices-inherent-00982',
  },
  {
    id: 'mexican-son', region: 'americas', place: 'Мексика', title: 'Мексиканский сон и мариачи', localName: 'son / mariachi', timeframe: 'Региональные традиции XVIII–XX веков',
    description: 'Сон объединяет поэтическую строфу, танец и струнный ансамбль; региональные варианты сон харочо, сон уастеко и западномексиканский мариачи сохраняют разные ритмические языки.',
    forms: ['сон харочо', 'сон уастеко', 'мариачи'], instruments: ['виуэла', 'харана', 'арпа', 'скрипка'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/mariachi-string-music-song-and-trumpet-00575',
  },
  {
    id: 'brazilian-capoeira', region: 'americas', place: 'Бразилия', title: 'Музыка круга капоэйры', localName: 'roda de capoeira', timeframe: 'Афро-бразильская живая традиция',
    description: 'Беримбау задаёт тип игры и ритмический рисунок, солист начинает песню, а круг отвечает хором. Музыка управляет скоростью, характером и драматургией движения.',
    forms: ['ладаинья', 'шула', 'корридо'], instruments: ['беримбау', 'атабаке', 'пандейру', 'голоса'],
    sourceLabel: 'UNESCO Intangible Cultural Heritage', sourceUrl: 'https://ich.unesco.org/en/RL/capoeira-circle-00892',
  },
]

export const folkRoutes: FolkRoute[] = [
  { id: 'northern-voices', number: 'R01', title: 'Северные голоса', caption: 'Руна / леэло / былина / эпос', traditionIds: ['karelian-runosong', 'seto-leelo', 'russian-north', 'yakut-olonkho'] },
  { id: 'epic-memory', number: 'R02', title: 'Эпос и устная память', caption: 'Сказитель / генеалогия / история', traditionIds: ['ukrainian-kobzar', 'yakut-olonkho', 'kyrgyz-manas', 'west-african-griot'] },
  { id: 'collective-polyphony', number: 'R03', title: 'Коллективная полифония', caption: 'Голос как общественное действие', traditionIds: ['seto-leelo', 'bulgarian-shopluk', 'georgian-polyphony', 'aka-polyphony'] },
  { id: 'drone-overtone', number: 'R04', title: 'Бурдон и обертоны', caption: 'Дам / горловое пение / дыхание', traditionIds: ['armenian-duduk', 'mongolian-khoomei', 'inuit-katajjaq', 'azerbaijani-mugham'] },
  { id: 'ritual-cycle', number: 'R05', title: 'Ритуал и календарь', caption: 'Обряд / сезон / танец', traditionIds: ['belarus-polissya', 'gnawa', 'aboriginal-song', 'andean-music'] },
  { id: 'creole-atlantic', number: 'R06', title: 'Атлантические встречи', caption: 'Миграция / память / новый ансамбль', traditionIds: ['appalachian-old-time', 'cuban-rumba', 'mexican-son', 'brazilian-capoeira'] },
]

export const folkSources = [
  { label: 'Карельские и ингерманландские мелодии', institution: 'University of Jyväskylä', url: 'https://esavelmat.jyu.fi/collection.html', note: '8613 оцифрованных мелодий с нотацией, местом записи и данными собирателя.' },
  { label: 'Traditional and Contemporary Culture', institution: 'Finnish Literature Society / SKS', url: 'https://www.finlit.fi/en/archives/archive-materials-on-traditional-and-contemporary-culture/', note: 'Полевые звукозаписи Финляндии, Карелии, Ингрии и других финно-угорских регионов.' },
  { label: 'UNESCO Collection of Traditional Music', institution: 'Smithsonian Folkways', url: 'https://folkways.si.edu/unesco', note: '127 альбомов полевых и студийных записей более чем из 70 стран.' },
  { label: 'Intangible Cultural Heritage', institution: 'UNESCO', url: 'https://ich.unesco.org/en/lists', note: 'Документация живых традиций, носителей и программ сохранения.' },
  { label: 'Traditional Music and Spoken Word', institution: 'Library of Congress', url: 'https://www.loc.gov/collections/traditional-music-and-spoken-word/about-this-collection/', note: 'Архивные карточки песен, сказаний и полевых записей 1897–1962 годов.' },
]

export const folkRegionCount = Object.keys(folkRegionLabels).length
