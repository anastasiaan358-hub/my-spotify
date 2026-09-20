export type MusicHistoryStream =
  | 'academic'
  | 'sacred'
  | 'traditional'
  | 'popular'
  | 'jazz'
  | 'electronic'
  | 'experimental'

export interface MusicHistoryEra {
  id: string
  number: string
  title: string
  englishTitle: string
  years: string
  description: string
  context: string
  streams: MusicHistoryStream[]
  genres: string[]
  figures: string[]
  landmark: string
  route?: string
}

export interface HistoryCollection {
  id: string
  number: string
  title: string
  caption: string
  description: string
  eraIds: string[]
  stream: MusicHistoryStream
  entries: Array<{
    artist: string
    work: string
    year: string
  }>
  route?: string
}

export interface HistorySource {
  label: string
  institution: string
  description: string
  url: string
}

export const musicHistoryStreamLabels: Record<MusicHistoryStream, string> = {
  academic: 'Академическая',
  sacred: 'Духовная',
  traditional: 'Народная',
  popular: 'Популярная',
  jazz: 'Блюз и джаз',
  electronic: 'Электронная',
  experimental: 'Экспериментальная',
}

export const musicHistoryEras: MusicHistoryEra[] = [
  {
    id: 'origins',
    number: '01',
    title: 'Древние традиции',
    englishTitle: 'Origins',
    years: 'ок. 2600 до н. э. — 500 н. э.',
    description: 'Первые тексты песен, системы ладов и сохранившаяся нотация Ближнего Востока, Египта, Греции и Рима.',
    context: 'Музыка существует в ритуале, театре, придворной церемонии и устной традиции; сохранившиеся записи дают лишь часть звукового мира.',
    streams: ['sacred', 'traditional', 'academic'],
    genres: ['храмовый гимн', 'плач', 'эпическая песнь', 'пеан', 'сколий', 'театральный хор', 'инструментальный сигнал', 'раннехристианский гимн'],
    figures: ['Энхедуанна', 'Еврипид', 'Афиней', 'Лимен', 'Месомед'],
    landmark: 'Хурритский гимн h.6 / эпитафия Сейкила / гимны Месомеда',
    route: '/ancient-music',
  },
  {
    id: 'middle-ages',
    number: '02',
    title: 'Средневековье',
    englishTitle: 'Middle Ages',
    years: '500—1400',
    description: 'Монодия и раннее многоголосие Европы соседствуют с византийскими, арабскими, еврейскими и живыми устными традициями.',
    context: 'Письменная нотация развивается в церковных и придворных центрах; менестрели, трубадуры и народные музыканты сохраняют другие репертуары устно.',
    streams: ['sacred', 'traditional', 'academic'],
    genres: ['григорианский хорал', 'византийский распев', 'органум', 'кондукт', 'мотет', 'секвенция', 'кантига', 'песня трубадуров', 'миннезанг', 'баллата', 'виреле', 'рондо'],
    figures: ['Хильдегарда Бингенская', 'Леонин', 'Перо́тин', 'Адам де ла Аль', 'Гильом де Машо'],
    landmark: 'От одноголосного распева к Ars nova и изоритмическому мотету',
  },
  {
    id: 'renaissance',
    number: '03',
    title: 'Возрождение',
    englishTitle: 'Renaissance',
    years: '1400—1600',
    description: 'Международная полифония, музыкальное книгопечатание, расцвет светской песни и самостоятельной инструментальной музыки.',
    context: 'Церковь, двор, город и домашнее музицирование образуют общую сеть; печать ускоряет движение сочинений между странами.',
    streams: ['academic', 'sacred', 'traditional'],
    genres: ['месса', 'мотет', 'шансон', 'мадригал', 'вильянсико', 'фроттола', 'лютневая песня', 'ричеркар', 'канцона', 'фантазия', 'павана', 'гальярда'],
    figures: ['Гийом Дюфаи', 'Жоскен Депре', 'Палестрина', 'Томас Таллис', 'Орландо ди Лассо', 'Карло Джезуальдо'],
    landmark: 'Полифоническая месса, мадригал и инструментальные формы получают устойчивый репертуар',
    route: '/artists/atlas?period=Renaissance',
  },
  {
    id: 'baroque',
    number: '04',
    title: 'Барокко',
    englishTitle: 'Baroque',
    years: '1600—1750',
    description: 'Опера, генерал-бас, тональная гармония, концертный принцип и новая виртуозность преобразуют европейскую музыку.',
    context: 'Музыкальный театр становится публичным институтом, а инструментальные ансамбли складываются в оркестр.',
    streams: ['academic', 'sacred', 'popular'],
    genres: ['опера', 'оратория', 'кантата', 'пассион', 'концерт', 'concerto grosso', 'сюита', 'соната', 'фуга', 'прелюдия', 'токката', 'вариации'],
    figures: ['Клаудио Монтеверди', 'Арканджело Корелли', 'Антонио Вивальди', 'И. С. Бах', 'Г. Ф. Гендель', 'Жан-Филипп Рамо'],
    landmark: 'От ранней оперы Монтеверди к позднебарочным циклам Баха и Генделя',
    route: '/artists/atlas?period=Baroque',
  },
  {
    id: 'classical',
    number: '05',
    title: 'Классицизм',
    englishTitle: 'Classical',
    years: 'ок. 1730—1820',
    description: 'Ясная фраза, тематическое развитие и публичный концерт формируют симфонию, квартет и классическую сонату.',
    context: 'Галантный и чувствительный стили ведут к венской классике; издательский рынок и концертная жизнь расширяют аудиторию.',
    streams: ['academic', 'popular'],
    genres: ['симфония', 'струнный квартет', 'соната', 'инструментальный концерт', 'опера-буффа', 'зингшпиль', 'дивертисмент', 'серенада'],
    figures: ['К. Ф. Э. Бах', 'Йозеф Гайдн', 'В. А. Моцарт', 'Кристоф Виллибальд Глюк', 'Людвиг ван Бетховен'],
    landmark: 'Сонатный цикл и симфонический оркестр становятся центральными моделями',
  },
  {
    id: 'romantic',
    number: '06',
    title: 'Романтизм',
    englishTitle: 'Romanticism',
    years: 'ок. 1810—1880',
    description: 'Личная поэтика, программность, песня, фортепианная миниатюра и расширенная оркестровая форма.',
    context: 'Концертная публичность, домашний рояль, виртуоз-исполнитель и национальная литература меняют производство и восприятие музыки.',
    streams: ['academic', 'traditional', 'popular'],
    genres: ['романс', 'Lied', 'ноктюрн', 'этюд', 'фортепианный цикл', 'симфоническая поэма', 'программная симфония', 'большая опера', 'музыкальная драма'],
    figures: ['Франц Шуберт', 'Гектор Берлиоз', 'Фридерик Шопен', 'Роберт Шуман', 'Ференц Лист', 'Рихард Вагнер'],
    landmark: 'Миниатюра и монументальная драма становятся двумя полюсами романтической формы',
  },
  {
    id: 'late-romantic',
    number: '07',
    title: 'Поздний романтизм и национальные школы',
    englishTitle: 'Late Romantic / National Schools',
    years: '1860—1918',
    description: 'Позднеромантический оркестр, веризм, импрессионизм и национальные школы входят в напряжённый диалог с фольклором.',
    context: 'Композиторы используют народные источники и новые тембры, но способы такого присвоения и репрезентации требуют отдельного исторического комментария.',
    streams: ['academic', 'traditional', 'experimental'],
    genres: ['позднеромантическая симфония', 'веризм', 'импрессионизм', 'симфоническая поэма', 'балет', 'национальная опера', 'фортепианная прелюдия', 'оркестровая песня'],
    figures: ['Иоганнес Брамс', 'П. И. Чайковский', 'Антонин Дворжак', 'Густав Малер', 'Клод Дебюсси', 'Джакомо Пуччини'],
    landmark: 'Тональность достигает предельного расширения, а тембр становится самостоятельным формообразующим фактором',
  },
  {
    id: 'recorded-roots',
    number: '08',
    title: 'Рождение записанной популярной музыки',
    englishTitle: 'Recorded Roots',
    years: '1870—1930',
    description: 'Спиричуэл, регтайм, блюз, госпел, кабаре, танго, фаду и ранняя звукозапись создают новые массовые репертуары.',
    context: 'Нотная индустрия, цилиндр и пластинка фиксируют лишь часть живых традиций и одновременно меняют длину, форму и распространение песни.',
    streams: ['traditional', 'popular', 'jazz'],
    genres: ['спиричуэл', 'регтайм', 'водевиль', 'кабаре', 'танго', 'фаду', 'сон кубано', 'болеро', 'кансон', 'ранний блюз', 'ранний госпел', 'Tin Pan Alley'],
    figures: ['Скотт Джоплин', 'Джеймс Риз Юроп', 'Карлос Гардель', 'Мейми Смит', 'Бесси Смит', 'Эрсилия Кошта'],
    landmark: 'Запись превращает исполнение в тиражируемый объект и формирует рынок жанров',
  },
  {
    id: 'modernism',
    number: '09',
    title: 'Модернизм',
    englishTitle: 'Modernism',
    years: '1890—1945',
    description: 'Атональность, серийность, политональность, новая ритмика, неоклассицизм и шум расширяют само понятие композиции.',
    context: 'Композиторы отвечают на урбанизацию, войну, технику и массовую культуру; единого модернистского языка не существует.',
    streams: ['academic', 'experimental', 'traditional'],
    genres: ['экспрессионизм', 'атональность', 'додекафония', 'неоклассицизм', 'футуризм', 'микротоновая музыка', 'новая объективность', 'ритуальный балет', 'фольклорный модернизм'],
    figures: ['Арнольд Шёнберг', 'Игорь Стравинский', 'Бела Барток', 'Чарлз Айвз', 'Эдгар Варез', 'Оливье Мессиан'],
    landmark: 'Музыкальный язык дробится на конкурирующие системы организации высоты, ритма и тембра',
  },
  {
    id: 'blues-jazz-country',
    number: '10',
    title: 'Блюз, джаз, госпел и кантри',
    englishTitle: 'Blues / Jazz / Gospel / Country',
    years: '1910—1955',
    description: 'Миграция, радио и звукозапись ускоряют развитие блюза, джаза, госпела и коммерческой кантри-музыки.',
    context: 'Импровизация, грув, вокальная манера и студийная фиксация создают ветви, которые определят популярную музыку второй половины века.',
    streams: ['jazz', 'popular', 'traditional', 'sacred'],
    genres: ['дельта-блюз', 'классический блюз', 'новоорлеанский джаз', 'свинг', 'бибоп', 'госпел', 'old-time', 'кантри', 'вестерн-свинг', 'блуграсс', 'jump blues', 'ритм-н-блюз'],
    figures: ['Луи Армстронг', 'Дюк Эллингтон', 'Роберт Джонсон', 'Махалия Джексон', 'Чарли Паркер', 'Хэнк Уильямс'],
    landmark: 'От коллективной импровизации Нового Орлеана к биг-бэнду, бибопу и электрическому R&B',
  },
  {
    id: 'postwar-art',
    number: '11',
    title: 'Послевоенный авангард',
    englishTitle: 'Post-war Avant-garde',
    years: '1945—1975',
    description: 'Тотальный сериализм, алеаторика, конкретная музыка, электронная студия, минимализм и новая импровизация.',
    context: 'Магнитная лента и синтез звука превращают студию в инструмент; партитура может задавать процесс, вероятность или действие.',
    streams: ['academic', 'electronic', 'experimental'],
    genres: ['тотальный сериализм', 'алеаторика', 'конкретная музыка', 'электроакустика', 'акусматика', 'спектральная музыка', 'минимализм', 'индетерминизм', 'графическая нотация', 'free improvisation'],
    figures: ['Пьер Шеффер', 'Джон Кейдж', 'Карлхайнц Штокхаузен', 'Янис Ксенакис', 'Стив Райх', 'Полин Оливерос'],
    landmark: 'Лента, генератор и случай становятся равноправными средствами композиции',
  },
  {
    id: 'mass-pop',
    number: '12',
    title: 'Электрическая популярная музыка',
    englishTitle: 'Electric Popular Music',
    years: '1945—1969',
    description: 'R&B, рок-н-ролл, соул, поп, фолк-ривайвл и студийный рок строят массовую культуру послевоенного поколения.',
    context: 'Микрофон, электрогитара, телевидение и долгоиграющая пластинка меняют голос, ансамбль и масштаб альбома.',
    streams: ['popular', 'jazz', 'traditional', 'experimental'],
    genres: ['ритм-н-блюз', 'рок-н-ролл', 'ду-воп', 'соул', 'Motown', 'серф-рок', 'фолк-ривайвл', 'фолк-рок', 'психоделический рок', 'гаражный рок', 'арт-поп', 'шансон', 'йе-йе'],
    figures: ['Рэй Чарльз', 'Чак Берри', 'Элвис Пресли', 'Арета Франклин', 'The Beatles', 'Джими Хендрикс'],
    landmark: 'Сингл, альбом и студийный монтаж становятся разными формами музыкального высказывания',
  },
  {
    id: 'global-seventies',
    number: '13',
    title: 'Глобальные 1960–1970-е',
    englishTitle: 'Global Sixties / Seventies',
    years: '1960—1979',
    description: 'Фанк, регги, даб, Afrobeat, фьюжн, прогрессивный рок, хард-рок, диско, краут-рок и эмбиент.',
    context: 'Международные сцены соединяются через пластинку и радио, но локальные студии и политические движения сохраняют собственную логику.',
    streams: ['popular', 'jazz', 'electronic', 'experimental', 'traditional'],
    genres: ['фанк', 'регги', 'даб', 'Afrobeat', 'босса-нова', 'сальса', 'джаз-фьюжн', 'прогрессивный рок', 'хард-рок', 'хэви-метал', 'краут-рок', 'диско', 'эмбиент', 'электронный поп'],
    figures: ['Джеймс Браун', 'Фела Кути', 'Боб Марли', 'Майлз Дэвис', 'Kraftwerk', 'Брайан Ино'],
    landmark: 'Грув, студийная обработка и синтезатор задают новые способы организации длительного трека',
  },
  {
    id: 'eighties',
    number: '14',
    title: 'Панк, хип-хоп и электронные сцены',
    englishTitle: '1976—1989',
    years: '1976—31 декабря 1989',
    description: 'Панк и постпанк, новая волна, хип-хоп, индастриал, синти-поп, метал, хаус, техно и независимые сцены.',
    context: 'Дешёвые синтезаторы, драм-машины, семплеры, кассеты и клубная инфраструктура распределяют производство между студиями, домами и танцполами.',
    streams: ['popular', 'electronic', 'experimental', 'jazz'],
    genres: ['панк', 'постпанк', 'new wave', 'готик-рок', 'индастриал', 'синти-поп', 'новая романтика', 'хардкор', 'трэш-метал', 'альтернативный рок', 'хип-хоп', 'электро', 'хаус', 'техно', 'Hi-NRG', 'worldbeat'],
    figures: ['Patti Smith', 'Talking Heads', 'Grandmaster Flash', 'Public Enemy', 'Frankie Knuckles', 'Juan Atkins'],
    landmark: 'Семпл, секвенсор и независимая сцена становятся полноценными моделями авторства и распространения',
  },
]

export const historyCollections: HistoryCollection[] = [
  {
    id: 'first-notation', number: 'C01', title: 'Первые записанные мелодии', caption: 'Табличка → папирус → камень',
    description: 'Памятники, по которым можно обсуждать не только текст, но и музыкальную запись.', eraIds: ['origins'], stream: 'academic', route: '/ancient-music',
    entries: [
      { artist: 'Неизвестный автор', work: 'Хурритский гимн Никкаль h.6', year: 'ок. 1400 до н. э.' },
      { artist: 'Еврипид (?)', work: 'Стасим из «Ореста»', year: '408 до н. э.' },
      { artist: 'Лимен', work: 'Второй Дельфийский гимн', year: '128 до н. э.' },
      { artist: 'Неизвестный автор', work: 'Эпитафия Сейкила', year: 'I–II век' },
    ],
  },
  {
    id: 'chant-polyphony', number: 'C02', title: 'От распева к многоголосию', caption: 'Монодия / органум / Ars nova',
    description: 'Как линия распева стала основанием для самостоятельных голосов и измеримого ритма.', eraIds: ['middle-ages'], stream: 'sacred',
    entries: [
      { artist: 'Хильдегарда Бингенская', work: 'Ordo Virtutum', year: 'ок. 1151' },
      { artist: 'Леонин', work: 'Viderunt omnes', year: 'XII век' },
      { artist: 'Перо́тин', work: 'Viderunt omnes', year: 'ок. 1198' },
      { artist: 'Гильом де Машо', work: 'Messe de Nostre Dame', year: 'до 1365' },
    ],
  },
  {
    id: 'renaissance-voices', number: 'C03', title: 'Полифоническая Европа', caption: 'Месса / мотет / печать',
    description: 'Четыре точки в развитии международного полифонического языка XV–XVI веков.', eraIds: ['renaissance'], stream: 'academic', route: '/artists/atlas?period=Renaissance',
    entries: [
      { artist: 'Гийом Дюфаи', work: 'Missa Se la face ay pale', year: '1450-е' },
      { artist: 'Жоскен Депре', work: 'Ave Maria… virgo serena', year: 'ок. 1485' },
      { artist: 'Палестрина', work: 'Missa Papae Marcelli', year: '1560-е' },
      { artist: 'Томас Таллис', work: 'Spem in alium', year: 'ок. 1570' },
    ],
  },
  {
    id: 'word-drama', number: 'C04', title: 'Слово становится драмой', caption: 'Мадригал → монодия → опера',
    description: 'Выразительная декламация и работа со словом на пути от мадригала к музыкальному театру.', eraIds: ['renaissance', 'baroque'], stream: 'academic',
    entries: [
      { artist: 'Лука Маренцио', work: 'Solo e pensoso', year: '1599' },
      { artist: 'Карло Джезуальдо', work: 'Moro, lasso, al mio duolo', year: '1611' },
      { artist: 'Клаудио Монтеверди', work: 'L’Orfeo', year: '1607' },
      { artist: 'Франческа Каччини', work: 'La liberazione di Ruggiero', year: '1625' },
    ],
  },
  {
    id: 'baroque-engine', number: 'C05', title: 'Механика барокко', caption: 'Бас / контрапункт / концерт',
    description: 'Контраст, вариация, basso continuo и полифония как двигатели крупной формы.', eraIds: ['baroque'], stream: 'academic', route: '/artists/atlas?period=Baroque',
    entries: [
      { artist: 'Арканджело Корелли', work: 'Concerti grossi, op. 6', year: '1714' },
      { artist: 'Антонио Вивальди', work: 'Le quattro stagioni', year: '1725' },
      { artist: 'И. С. Бах', work: 'Das wohltemperierte Klavier I', year: '1722' },
      { artist: 'Г. Ф. Гендель', work: 'Messiah', year: '1741' },
    ],
  },
  {
    id: 'classical-architecture', number: 'C06', title: 'Архитектура классической формы', caption: 'Соната / квартет / симфония',
    description: 'Тематический контраст, развитие и возвращение в камерной и оркестровой музыке.', eraIds: ['classical'], stream: 'academic',
    entries: [
      { artist: 'Йозеф Гайдн', work: 'Квартеты op. 33', year: '1781' },
      { artist: 'В. А. Моцарт', work: 'Симфония № 40', year: '1788' },
      { artist: 'Людвиг ван Бетховен', work: 'Симфония № 3', year: '1803–1804' },
      { artist: 'Франц Шуберт', work: 'Симфония № 8', year: '1822' },
    ],
  },
  {
    id: 'romantic-private', number: 'C07', title: 'Романтический внутренний голос', caption: 'Песня / миниатюра / цикл',
    description: 'Камерные жанры, в которых поэзия, память и фортепианный жест образуют личный дневник.', eraIds: ['romantic'], stream: 'academic',
    entries: [
      { artist: 'Франц Шуберт', work: 'Winterreise', year: '1827' },
      { artist: 'Фридерик Шопен', work: '24 прелюдии, op. 28', year: '1835–1839' },
      { artist: 'Роберт Шуман', work: 'Dichterliebe', year: '1840' },
      { artist: 'Фанни Мендельсон', work: 'Das Jahr', year: '1841' },
    ],
  },
  {
    id: 'romantic-orchestra', number: 'C08', title: 'Оркестр как мир', caption: 'Программа / драма / симфония',
    description: 'От программной симфонии до музыкальной драмы и позднеромантической формы.', eraIds: ['romantic', 'late-romantic'], stream: 'academic',
    entries: [
      { artist: 'Гектор Берлиоз', work: 'Symphonie fantastique', year: '1830' },
      { artist: 'Рихард Вагнер', work: 'Tristan und Isolde', year: '1859' },
      { artist: 'П. И. Чайковский', work: 'Симфония № 6', year: '1893' },
      { artist: 'Густав Малер', work: 'Симфония № 9', year: '1909' },
    ],
  },
  {
    id: 'modernist-breaks', number: 'C09', title: 'Разрывы модернизма', caption: 'Тембр / ритм / новая высота',
    description: 'Несколько несовместимых ответов на кризис романтического музыкального языка.', eraIds: ['late-romantic', 'modernism'], stream: 'experimental',
    entries: [
      { artist: 'Клод Дебюсси', work: 'Prélude à l’après-midi d’un faune', year: '1894' },
      { artist: 'Арнольд Шёнберг', work: 'Pierrot lunaire', year: '1912' },
      { artist: 'Игорь Стравинский', work: 'Le Sacre du printemps', year: '1913' },
      { artist: 'Бела Барток', work: 'Музыка для струнных, ударных и челесты', year: '1936' },
    ],
  },
  {
    id: 'blues-line', number: 'C10', title: 'Блюзовая линия', caption: 'Сельский Юг → город → электричество',
    description: 'Не единая лестница прогресса, а сеть региональных школ, исполнительских манер и рынков записи.', eraIds: ['recorded-roots', 'blues-jazz-country', 'mass-pop'], stream: 'jazz',
    entries: [
      { artist: 'Мейми Смит', work: 'Crazy Blues', year: '1920' },
      { artist: 'Чарли Паттон', work: 'Pony Blues', year: '1929' },
      { artist: 'Роберт Джонсон', work: 'Cross Road Blues', year: '1936' },
      { artist: 'Мадди Уотерс', work: 'Hoochie Coochie Man', year: '1954' },
    ],
  },
  {
    id: 'jazz-languages', number: 'C11', title: 'Языки джаза', caption: 'Новый Орлеан → свинг → бибоп → modal/free',
    description: 'История меняющихся ансамблей, ритмических концепций и способов импровизации.', eraIds: ['blues-jazz-country', 'postwar-art', 'global-seventies'], stream: 'jazz',
    entries: [
      { artist: 'Луи Армстронг', work: 'West End Blues', year: '1928' },
      { artist: 'Дюк Эллингтон', work: 'Ko-Ko', year: '1940' },
      { artist: 'Чарли Паркер', work: 'Ko-Ko', year: '1945' },
      { artist: 'Орнетт Коулман', work: 'Free Jazz', year: '1960' },
    ],
  },
  {
    id: 'gospel-rnb-soul', number: 'C12', title: 'Госпел, R&B и соул', caption: 'Церковь / сцена / гражданские права',
    description: 'Вокальная техника и ансамблевая энергия госпела в светской музыке середины XX века.', eraIds: ['blues-jazz-country', 'mass-pop', 'global-seventies'], stream: 'popular',
    entries: [
      { artist: 'Махалия Джексон', work: 'Move On Up a Little Higher', year: '1947' },
      { artist: 'Рэй Чарльз', work: 'What’d I Say', year: '1959' },
      { artist: 'Арета Франклин', work: 'Respect', year: '1967' },
      { artist: 'Марвин Гэй', work: 'What’s Going On', year: '1971' },
    ],
  },
  {
    id: 'country-folk', number: 'C13', title: 'Записанный фолк и кантри', caption: 'Полевой архив / радио / авторская песня',
    description: 'Как устные и региональные репертуары меняются в архиве, эфире и коммерческой записи.', eraIds: ['recorded-roots', 'blues-jazz-country', 'mass-pop'], stream: 'traditional',
    entries: [
      { artist: 'The Carter Family', work: 'Can the Circle Be Unbroken', year: '1935' },
      { artist: 'Вуди Гатри', work: 'This Land Is Your Land', year: '1940' },
      { artist: 'Хэнк Уильямс', work: 'I’m So Lonesome I Could Cry', year: '1949' },
      { artist: 'Одетта', work: 'Odetta Sings Ballads and Blues', year: '1956' },
    ],
  },
  {
    id: 'postwar-laboratory', number: 'C14', title: 'Студия как лаборатория', caption: 'Лента / синтез / пространство',
    description: 'От конкретного звука и генератора до пространственной композиции и повторяющегося процесса.', eraIds: ['postwar-art', 'global-seventies'], stream: 'electronic',
    entries: [
      { artist: 'Пьер Шеффер', work: 'Étude aux chemins de fer', year: '1948' },
      { artist: 'Карлхайнц Штокхаузен', work: 'Gesang der Jünglinge', year: '1955–1956' },
      { artist: 'Дафна Орам', work: 'Four Aspects', year: '1960' },
      { artist: 'Стив Райх', work: 'It’s Gonna Rain', year: '1965' },
    ],
  },
  {
    id: 'rock-transformations', number: 'C15', title: 'Трансформации рока', caption: 'Рифф / песня / альбом',
    description: 'От танцевального сингла через студийный альбом к тяжёлому и прогрессивному звуку.', eraIds: ['mass-pop', 'global-seventies'], stream: 'popular',
    entries: [
      { artist: 'Чак Берри', work: 'Maybellene', year: '1955' },
      { artist: 'The Beatles', work: 'Tomorrow Never Knows', year: '1966' },
      { artist: 'Джими Хендрикс', work: 'Voodoo Child (Slight Return)', year: '1968' },
      { artist: 'Black Sabbath', work: 'Black Sabbath', year: '1970' },
    ],
  },
  {
    id: 'black-atlantic', number: 'C16', title: 'Чёрная Атлантика', caption: 'Фанк / Afrobeat / регги / даб',
    description: 'Транснациональная подборка грува, политической песни и студийной переработки.', eraIds: ['mass-pop', 'global-seventies'], stream: 'popular',
    entries: [
      { artist: 'Джеймс Браун', work: 'Cold Sweat', year: '1967' },
      { artist: 'Fela Kuti', work: 'Zombie', year: '1976' },
      { artist: 'The Congos', work: 'Heart of the Congos', year: '1977' },
      { artist: 'Lee “Scratch” Perry', work: 'Disco Devil', year: '1977' },
    ],
  },
  {
    id: 'global-dance', number: 'C17', title: 'Глобальные танцевальные формы', caption: 'Танго / сон / босса / сальса',
    description: 'Городские жанры, возникшие из локальных ритмов, миграций и международной индустрии записи.', eraIds: ['recorded-roots', 'blues-jazz-country', 'global-seventies'], stream: 'traditional',
    entries: [
      { artist: 'Карлос Гардель', work: 'Mi noche triste', year: '1917' },
      { artist: 'Arsenio Rodríguez', work: 'Fuego en el 23', year: '1940-е' },
      { artist: 'Жуан Жилберту', work: 'Chega de Saudade', year: '1958' },
      { artist: 'Celia Cruz / Johnny Pacheco', work: 'Quimbara', year: '1974' },
    ],
  },
  {
    id: 'synthesizer-line', number: 'C18', title: 'Синтезатор становится массовым', caption: 'Модуль → секвенсор → поп',
    description: 'Электронный тембр проходит путь от специализированной студии до альбома, клуба и домашнего производства.', eraIds: ['postwar-art', 'global-seventies', 'eighties'], stream: 'electronic',
    entries: [
      { artist: 'Венди Карлос', work: 'Switched-On Bach', year: '1968' },
      { artist: 'Kraftwerk', work: 'Trans-Europe Express', year: '1977' },
      { artist: 'Yellow Magic Orchestra', work: 'Solid State Survivor', year: '1979' },
      { artist: 'Depeche Mode', work: 'Black Celebration', year: '1986' },
    ],
  },
  {
    id: 'disco-club', number: 'C19', title: 'От диско к хаусу и техно', caption: 'Танцпол / DJ / drum machine',
    description: 'Непрерывный микс, электронный пульс и клуб как место рождения формы.', eraIds: ['global-seventies', 'eighties'], stream: 'electronic',
    entries: [
      { artist: 'Donna Summer', work: 'I Feel Love', year: '1977' },
      { artist: 'Frankie Knuckles / Jamie Principle', work: 'Your Love', year: '1986' },
      { artist: 'Phuture', work: 'Acid Tracks', year: '1987' },
      { artist: 'Rhythim Is Rhythim', work: 'Strings of Life', year: '1987' },
    ],
  },
  {
    id: 'punk-after', number: 'C20', title: 'Панк и всё после', caption: 'DIY / постпанк / независимая сцена',
    description: 'Короткая форма, самостоятельное производство и расширение языка рок-группы.', eraIds: ['eighties'], stream: 'popular',
    entries: [
      { artist: 'Ramones', work: 'Blitzkrieg Bop', year: '1976' },
      { artist: 'Patti Smith', work: 'Radio Ethiopia', year: '1976' },
      { artist: 'Joy Division', work: 'Unknown Pleasures', year: '1979' },
      { artist: 'Sonic Youth', work: 'Daydream Nation', year: '1988' },
    ],
  },
  {
    id: 'hip-hop', number: 'C21', title: 'Хип-хоп до 1990', caption: 'Break / MC / sample / studio',
    description: 'От районной вечеринки и брейка к семплерной композиции и политическому альбому.', eraIds: ['eighties'], stream: 'popular',
    entries: [
      { artist: 'The Sugarhill Gang', work: 'Rapper’s Delight', year: '1979' },
      { artist: 'Grandmaster Flash and the Furious Five', work: 'The Message', year: '1982' },
      { artist: 'Run-D.M.C.', work: 'It’s Like That', year: '1983' },
      { artist: 'Public Enemy', work: 'It Takes a Nation of Millions…', year: '1988' },
    ],
  },
  {
    id: 'metal-branches', number: 'C22', title: 'Ветви метала', caption: 'Heavy / doom / thrash / extreme',
    description: 'Утяжеление риффа, тембра и скорости от раннего heavy metal к сценам 1980-х.', eraIds: ['global-seventies', 'eighties'], stream: 'popular',
    entries: [
      { artist: 'Black Sabbath', work: 'Master of Reality', year: '1971' },
      { artist: 'Judas Priest', work: 'Stained Class', year: '1978' },
      { artist: 'Metallica', work: 'Master of Puppets', year: '1986' },
      { artist: 'Napalm Death', work: 'Scum', year: '1987' },
    ],
  },
]

export const musicHistorySources: HistorySource[] = [
  {
    label: 'Music in the Renaissance', institution: 'The Metropolitan Museum of Art',
    description: 'Музыка, печать, церковные и светские жанры 1400–1600 годов.',
    url: 'https://www.metmuseum.org/toah/hd/renm/hd_renm.htm',
  },
  {
    label: 'Musical Instruments', institution: 'The Metropolitan Museum of Art',
    description: 'Коллекция инструментов шести континентов от древности до современности.',
    url: 'https://www.metmuseum.org/departments/musical-instruments',
  },
  {
    label: 'Music Collections Policy', institution: 'Library of Congress',
    description: 'Карта академических, народных и популярных жанров в национальной коллекции.',
    url: 'https://www.loc.gov/acq/devpol/music.pdf',
  },
  {
    label: 'Blues Resources', institution: 'Library of Congress / American Folklife Center',
    description: 'История блюза и архивные полевые записи.',
    url: 'https://guides.loc.gov/folklife-blues',
  },
  {
    label: 'Rhythm and Blues', institution: 'Library of Congress',
    description: 'Происхождение термина и связь R&B с блюзом, джазом, госпелом и рок-н-роллом.',
    url: 'https://www.loc.gov/collections/songs-of-america/articles-and-essays/musical-styles/popular-songs-of-the-day/rhythm-and-blues/',
  },
  {
    label: 'African American Gospel', institution: 'Library of Congress',
    description: 'Формирование госпела и его связь со спиричуэлом, блюзом и R&B.',
    url: 'https://www.loc.gov/collections/songs-of-america/articles-and-essays/musical-styles/ritual-and-worship/african-american-gospel',
  },
]

export const uniqueMusicHistoryGenreCount = new Set(musicHistoryEras.flatMap((era) => era.genres)).size
