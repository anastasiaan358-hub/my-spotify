export type QuotationCertainty = 'documented' | 'disputed'

export interface CatalogEntry {
  artistId: string
  workId: string
}

export interface QuotationWork {
  composerId: string
  composer: string
  title: string
  date?: string
  catalogEntries?: CatalogEntry[]
  scoreRoute?: string | null
  detailLink?: {
    label: string
    url: string
    external?: boolean
  }
}

export interface QuotationReuse extends QuotationWork {
  relation: string
  evidence: string
}

export interface ResearchSource {
  label: string
  reference: string
  url: string
  kind: 'Первичный источник' | 'Исследование' | 'Научный справочник' | 'Каталог источников'
}

export interface QuotationRecord {
  id: string
  title: string
  type: string
  certainty: QuotationCertainty
  certaintyNote: string
  summary: string
  model: QuotationWork
  reuses: QuotationReuse[]
  techniques: string[]
  laterTrace: string[]
  sources: ResearchSource[]
}

const victoriaSources: ResearchSource[] = [
  {
    label: 'A History of Western Choral Music, vol. 1',
    reference: 'Chester L. Alwes, Oxford University Press, 2015, раздел о Victoria',
    url: 'https://global.oup.com/academic/product/a-history-of-western-choral-music-volume-1-9780199361939',
    kind: 'Исследование',
  },
  {
    label: 'Victoria on the Quatercentenary of his Death',
    reference: 'Edinburgh Research Archive: исследования о мессах и собственных мотетах Victoria',
    url: 'https://www.research.ed.ac.uk/files/16349465/Victoria_on_the_Quatercentenary_of_his_Death.pdf',
    kind: 'Исследование',
  },
  {
    label: 'Tomás Luis de Victoria — Polish Music Library',
    reference: 'Энциклопедическая статья о моделях имитационных месс',
    url: 'https://polskabibliotekamuzyczna.pl/encyklopedia/victoria-tomas-luis-de/',
    kind: 'Научный справочник',
  },
]

const palestrinaSources: ResearchSource[] = [
  {
    label: 'A History of Western Choral Music, vol. 1',
    reference: 'Chester L. Alwes, Oxford University Press, 2015, глава «The Renaissance Era»',
    url: 'https://global.oup.com/academic/product/a-history-of-western-choral-music-volume-1-9780199361939',
    kind: 'Исследование',
  },
  {
    label: 'Giovanni Pierluigi da Palestrina — Polish Music Library',
    reference: 'Энциклопедическая статья о типах месс и их моделях',
    url: 'https://polskabibliotekamuzyczna.pl/encyklopedia/palestrina-giovanni-pierluigi-da/',
    kind: 'Научный справочник',
  },
  {
    label: 'List of works by Giovanni Pierluigi da Palestrina',
    reference: 'Каталог произведений с указанием моделей для имитационных месс',
    url: 'https://imslp.org/wiki/List_of_works_by_Giovanni_Pierluigi_da_Palestrina',
    kind: 'Каталог источников',
  },
]

function victoriaWork(workId: string, title: string): QuotationWork {
  return {
    composerId: 'victoria-tomas-luis-de',
    composer: 'Томас Луис де Виктория',
    title,
    catalogEntries: [
      { artistId: 'victoria', workId },
      { artistId: 'victoria-tomas-luis-de', workId },
    ],
  }
}

function victoriaReuse(workId: string, title: string, evidence: string): QuotationReuse {
  return {
    ...victoriaWork(workId, title),
    relation: 'Имитационная месса на собственный мотет',
    evidence,
  }
}

function victoriaRecord(
  id: string,
  modelId: string,
  modelTitle: string,
  massId: string,
  massTitle: string,
  evidence: string,
  techniques: string[],
): QuotationRecord {
  return {
    id,
    title: `${modelTitle} → ${massTitle}`,
    type: 'Самозаимствование / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Мотет указан в музыковедческой литературе как модель одноимённой мессы Victoria.',
    summary: `Victoria переносит полифонический материал собственного мотета «${modelTitle}» в ординарий мессы. Это не буквальная вставка целого произведения: исходные голосовые комплексы становятся материалом для новых разделов и кадансов.`,
    model: victoriaWork(modelId, modelTitle),
    reuses: [victoriaReuse(massId, massTitle, evidence)],
    techniques,
    laterTrace: [
      'Связь входит в группу из семи месс Victoria, основанных на его собственных мотетах.',
      'В дальнейшем этот способ объединения мотетной риторики и крупного литургического цикла становится одной из характерных черт рецепции стиля Victoria.',
    ],
    sources: victoriaSources,
  }
}

function palestrinaWork(workId: string, title: string): QuotationWork {
  return {
    composerId: 'palestrina-giovanni-pierluigi-da',
    composer: 'Джованни Пьерлуиджи да Палестрина',
    title,
    catalogEntries: [{ artistId: 'palestrina-giovanni-pierluigi-da', workId }],
  }
}

function ancientWork(workId: string, title: string, composer: string, date: string): QuotationWork {
  return {
    composerId: 'ancient-music',
    composer,
    title,
    date,
    catalogEntries: [{ artistId: 'ancient', workId }],
    scoreRoute: null,
    detailLink: { label: 'Древний каталог', url: '/ancient-music' },
  }
}

function externalReuse(
  composerId: string,
  composer: string,
  title: string,
  date: string,
  relation: string,
  evidence: string,
  url: string,
  linkLabel = 'Первоисточник',
): QuotationReuse {
  return {
    composerId,
    composer,
    title,
    date,
    relation,
    evidence,
    scoreRoute: null,
    detailLink: { label: linkLabel, url, external: true },
  }
}

export const quotationRecords: QuotationRecord[] = [
  {
    id: 'ancient-hurrian-echoes-ugarit',
    title: 'Гимн Никкаль h.6 → Echoes from Ugarit',
    type: 'Реконструкция / оркестровая переработка',
    certainty: 'documented',
    certaintyNote: 'Использование таблички h.6 Малеком Джандали подтверждено авторской программой. При этом единого научного прочтения высот и ритма хурритской записи не существует, поэтому связь с источником документирована, а звучание древней версии реконструктивно.',
    summary: 'Малек Джандали перенёс одну из современных расшифровок Хурритского гимна Никкаль в пьесу для фортепиано с оркестром. Древний материал стал тематическим ядром современной симфонической фактуры, но его нельзя принимать за бесспорное восстановление исполнения XIV века до н. э.',
    model: ancientWork('hurrian-hymn-6', 'Хурритский гимн Никкаль h.6', 'Неизвестный хурритский автор', 'ок. 1400 до н. э.'),
    reuses: [externalReuse(
      'jandali-malek',
      'Малек Джандали',
      'Echoes from Ugarit',
      '2009',
      'Современная оркестровка древней нотации',
      'Автор сообщает, что перенёс выбранную расшифровку в ре минор, сохранил её ритмическое ядро и развернул для фортепиано, арфы, духовых, ударных и струнных.',
      'https://malekjandali.com/echoes-from-ugarit/',
      'Программа автора',
    )],
    techniques: [
      'Древняя последовательность из выбранной расшифровки работает как основная тема.',
      'Одноголосный материал получает тональную гармонию и симфоническую драматургию.',
      'Арфа напоминает о предполагаемом струнном сопровождении, указанном клинописной табличкой.',
    ],
    laterTrace: [
      'Произведение вошло в одноимённый альбом для фортепиано и оркестра, записанный с Российским филармоническим оркестром.',
      'Различные расшифровки h.6 дают разные мелодии; поэтому последующие версии следует сравнивать с конкретной научной реконструкцией, а не с единственной «оригинальной мелодией».',
    ],
    sources: [
      {
        label: 'Echoes from Ugarit',
        reference: 'Официальная программа Малека Джандали: состав, перенос в ре минор и способ современной оркестровки h.6',
        url: 'https://malekjandali.com/echoes-from-ugarit/',
        kind: 'Первичный источник',
      },
      {
        label: 'Rethinking ancient music interpretation through Hurrian Hymn H6',
        reference: 'Early Music 53/3: обзор неоднозначностей чтения клинописной нотации и современных реконструкций',
        url: 'https://academic.oup.com/em/article/53/3/284/8442961',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'ancient-orestes-morsink',
    title: 'Стасим из «Ореста» → Orestes’ Chamber',
    type: 'Прямая цитата / современная композиция',
    certainty: 'documented',
    certaintyNote: 'Композитор Coreen Morsink прямо называет папирус G 2315 источником цитаты и показывает её расположение и преобразования в авторском исследовании и партитуре.',
    summary: 'В камерном цикле Orestes’ Chamber фрагмент мелодии с Венского папируса становится слышимой цитатой. Morsink сначала восстанавливает лакуны по собственному методу, затем проводит полученный мотив через точное повторение, микроинтервальные варианты и гетерофонию.',
    model: ancientWork('orestes-stasimon', 'Стасим из «Ореста», папирус G 2315', 'Еврипид (текст); музыка неизвестного автора', 'текст 408 до н. э.; ноты ок. 200 до н. э.'),
    reuses: [externalReuse(
      'morsink-coreen',
      'Coreen Emmie Rose Morsink',
      'Orestes’ Chamber',
      '2013',
      'Четырёхчастное камерное сочинение с прямой цитатой',
      'Первая часть цитирует G 2315; реконструированный мотив точно звучит у гобоя и затем изменяется в третьей части для создания гетерофонии.',
      'https://research.gold.ac.uk/id/eprint/9149/1/MUS_thesis_Morsink_2013.pdf',
      'Исследование и партитура',
    )],
    techniques: [
      'Точное изложение реконструированного мотива у гобоя.',
      'Микроинтервальная обработка через древнегреческие тетрахорды.',
      'Гетерофонные варианты меняют регистр, орнамент, ритм и тембровое распределение цитаты.',
    ],
    laterTrace: [
      'Цитата связывает сохранившиеся знаки папируса с новым ансамблем: сопрано, гобой, перенастроенная гитара, подготовленное фортепиано и ударные.',
      'Автор подчёркивает, что заполнение повреждённых мест является её реконструкцией; точной версии античного исполнения установить нельзя.',
    ],
    sources: [
      {
        label: 'The Composition of New Music Inspired by Music Philosophy and Musical Theoretical Writings from Ancient Greece',
        reference: 'Coreen Morsink, Goldsmiths, 2013, раздел 6.1: прямая цитата G 2315 и её гетерофонные преобразования',
        url: 'https://research.gold.ac.uk/id/eprint/9149/1/MUS_thesis_Morsink_2013.pdf',
        kind: 'Первичный источник',
      },
      {
        label: 'Orestes von Euripides mit Musiknotation',
        reference: 'Австрийская национальная библиотека: описание Венского папируса G 2315',
        url: 'https://www.onb.ac.at/museen/papyrusmuseum/programm/dauerausstellung/die-themenbereiche-der-ausstellung/orestes-von-euripides-mit-musiknoten',
        kind: 'Каталог источников',
      },
    ],
  },
  {
    id: 'ancient-first-delphic-faure',
    title: 'Первый Дельфийский гимн → Fauré',
    type: 'Древняя мелодия / современная гармонизация',
    certainty: 'documented',
    certaintyNote: 'Издание 1894 года в каталоге Национальной библиотеки Франции прямо разделяет роли: транскрипция Théodore Reinach и сопровождение Gabriel Fauré.',
    summary: 'После расшифровки каменной надписи Gabriel Fauré сохранил транскрибированную древнюю вокальную линию и написал к ней новое сопровождение. Это не стилизация на античную тему, а поздняя фактура вокруг конкретной мелодии Первого Дельфийского гимна.',
    model: ancientWork('first-delphic-hymn', 'Первый Дельфийский гимн Аполлону', 'Афиней, сын Афинея', '128 до н. э.'),
    reuses: [externalReuse(
      'faure-gabriel',
      'Габриель Форе; транскрипция Теодора Райнаха',
      'Hymne à Apollon, Op. 63bis',
      '1894; редакция 1914',
      'Гармонизация и инструментальное сопровождение древней мелодии',
      'Вокальная линия следует транскрипции Райнаха; Форе добавляет гармонию, повтор раздела и сопровождение, которых на камне нет.',
      'https://catalogue.bnf.fr/ark:/12148/cb429824832',
      'Каталог BnF',
    )],
    techniques: [
      'Античная монодия сохранена как главный голос.',
      'Добавлены фортепианная или ансамблевая гармония и современная форма исполнения.',
      'Повтор одного раздела компенсирует повреждение заключительной части надписи.',
    ],
    laterTrace: [
      'Первая полная парижская версия прозвучала 12 апреля 1894 года, вскоре после археологической находки.',
      'Гармонизация участвовала в ранней современной рецепции Дельфийского гимна и была переиздана в исправленной редакции.',
    ],
    sources: [
      {
        label: 'Hymne à Apollon — notice bibliographique',
        reference: 'Bibliothèque nationale de France: Reinach — транскрипция, Fauré — сопровождение, издание 1894 года',
        url: 'https://catalogue.bnf.fr/ark:/12148/cb429824832',
        kind: 'Каталог источников',
      },
      {
        label: 'The reception of ancient Greek music in the late nineteenth century',
        reference: 'Samuel N. Dorf: история транскрипции, заказа сопровождения и исполнений 1894–1895 годов',
        url: 'https://experts.illinois.edu/en/publications/the-reception-of-ancient-greek-music-in-the-late-nineteenth-centu/',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'ancient-second-delphic-boellmann',
    title: 'Второй Дельфийский гимн → Boëllmann',
    type: 'Древняя мелодия / современная гармонизация',
    certainty: 'documented',
    certaintyNote: 'Публикация и исполнение 1897 года документированы Théodore Reinach; музыковедческая литература прямо называет Léon Boëllmann автором гармонизации Второго гимна.',
    summary: 'Léon Boëllmann продолжил работу, начатую с Первым Дельфийским гимном: транскрибированный материал Лимения получил современное сопровождение для концертного исполнения. Сохранившиеся античные участки остаются моделью, а гармоническое окружение принадлежит XIX веку.',
    model: ancientWork('second-delphic-hymn', 'Второй Дельфийский гимн Аполлону', 'Лимений, сын Фоина', '128 до н. э.'),
    reuses: [externalReuse(
      'boellmann-leon',
      'Леон Боэльман; транскрипция Теодора Райнаха',
      'Le second hymne delphique à Apollon',
      '1897',
      'Гармонизация для голоса и фортепиано',
      'Боэльман создаёт сопровождение для транскрипции Райнаха, заполняя концертную фактуру вокруг фрагментарно сохранившейся мелодии Лимения.',
      'https://www.persee.fr/doc/reg_0035-2039_1897_num_10_38_5798',
      'Публикация 1897',
    )],
    techniques: [
      'Транскрибированная античная линия остаётся тематической основой.',
      'Фортепианное сопровождение переводит монодический памятник в салонно-концертную практику XIX века.',
      'Лакуны камня требуют редакторских решений, которые нельзя считать частью оригинала.',
    ],
    laterTrace: [
      'Версия была представлена Ассоциации содействия греческим исследованиям 3 июня 1897 года.',
      'Пара Fauré—Boëllmann сформировала первую заметную волну концертной рецепции двух Дельфийских гимнов.',
    ],
    sources: [
      {
        label: 'Exécution du second hymne Delphique à Apollon',
        reference: 'Théodore Reinach, Revue des Études Grecques 10 (1897), pp. 35–42',
        url: 'https://www.persee.fr/doc/reg_0035-2039_1897_num_10_38_5798',
        kind: 'Первичный источник',
      },
      {
        label: 'The Delphic Hymn, Antigone, and a Brief Revival of Ancient Greek Music',
        reference: 'Philomusica on-line 7: Fauré отказался от второго гимна; гармонизацию выполнил Léon Boëllmann',
        url: 'https://riviste.paviauniversitypress.it/index.php/phi/article/viewFile/07-02-Moisa-15/07-02-MOISA-15',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'ancient-seikilos-afterlife',
    title: 'Песня Сейкила → две современные цитаты',
    type: 'Полная и мотивная цитата / современные сочинения',
    certainty: 'documented',
    certaintyNote: 'Оба композитора сами описывают использование древней мелодии: Samuel Lord Kalcheim указывает полную цитату и её такты, Alex Weiser — узнаваемый начальный интервал.',
    summary: 'Целостность мелодии Сейкила сделала её удобной моделью для новых сочинений. В опере Kalcheim она сначала целиком звучит у арфы, затем возвращается фрагментами; Weiser сохраняет более короткий опознавательный жест — восходящую квинту начала.',
    model: ancientWork('seikilos-song', 'Песня со стелы Сейкила', 'Неизвестный автор; возможно Сейкил', 'ок. 100—200 н. э.'),
    reuses: [
      externalReuse(
        'kalcheim-samuel-lord',
        'Samuel Lord Kalcheim',
        'The Metamorphosis of Gertrude and Jo',
        '2020',
        'Сквозная цитата в камерной опере',
        'Полная мелодия звучит в первом вступлении арфы, такты 31–38, и возвращается полностью или фрагментарно на протяжении оперы; текст становится финальной арией.',
        'https://scholarsbank.uoregon.edu/server/api/core/bitstreams/7043d346-386f-4f3f-966f-7f789b03b136/content',
        'Партитура и комментарий',
      ),
      externalReuse(
        'weiser-alex',
        'Алекс Вайзер',
        'Three Epitaphs',
        '2016',
        'Мотивная отсылка в вокально-инструментальном цикле',
        'Английский перевод текста положен на новую музыку, а начало древней мелодии отмечено восходящей чистой квинтой.',
        'https://www.alexweiser.com/works/three-epitaphs',
        'Комментарий автора',
      ),
    ],
    techniques: [
      'Полная цитата превращается в лейтматериал оперы Kalcheim.',
      'Фрагментация позволяет древней теме возвращаться вне буквального повторения.',
      'У Weiser один интервальный жест сохраняет память об оригинале внутри новой мелодии.',
    ],
    laterTrace: [
      'У Kalcheim содержание эпитафии связано с превращением и смертью героинь; древний текст завершает драму.',
      'У Weiser текст Сейкила помещён между эпитафиями William Carlos Williams и Emily Dickinson в размышлении о быстротечности жизни.',
    ],
    sources: [
      {
        label: 'The Metamorphosis of Gertrude and Jo, a Chamber Opera',
        reference: 'Samuel Lord Kalcheim, University of Oregon, 2020: полная цитата в арфе, такты 31–38, и дальнейшие возвращения',
        url: 'https://scholarsbank.uoregon.edu/server/api/core/bitstreams/7043d346-386f-4f3f-966f-7f789b03b136/content',
        kind: 'Первичный источник',
      },
      {
        label: 'Three Epitaphs',
        reference: 'Авторская программа Alex Weiser: новая вокальная версия с отсылкой к начальной восходящей квинте Сейкила',
        url: 'https://www.alexweiser.com/works/three-epitaphs',
        kind: 'Первичный источник',
      },
      {
        label: 'The Seikilos stele',
        reference: 'National Museum of Denmark: музейный контекст оригинальной стелы и её нотации',
        url: 'https://natmus.dk/historisk-viden/verden/middelhavslandene/graekenland/de-foerste-noder/',
        kind: 'Каталог источников',
      },
    ],
  },
  {
    id: 'ancient-oxyrhynchus-first-hymn',
    title: 'Оксиринхский гимн → The First Hymn',
    type: 'Современная песенная переработка',
    certainty: 'documented',
    certaintyNote: 'Авторы и официальный проект прямо указывают P.Oxy. 1786 как музыкальный и текстовый источник современной песни 2025 года.',
    summary: 'Chris Tomlin, Ben Fielding и John Dickson превратили фрагмент P.Oxy. 1786 в современную песню для общего пения. Древние слова и мелодические элементы включены в новую куплетно-припевную форму, поэтому это переработка, а не реконструкция полного утраченного гимна.',
    model: ancientWork('oxyrhynchus-hymn', 'Оксиринхский христианский гимн, P.Oxy. 1786', 'Неизвестный автор', 'конец III—начало IV века н. э.'),
    reuses: [externalReuse(
      'tomlin-fielding-dickson',
      'Chris Tomlin, Ben Fielding и John Dickson',
      'The First Hymn',
      '2025',
      'Современная worship-песня на материале папируса',
      'Авторы используют сохранившиеся 35 слов и музыкальные знаки как исходный материал, дополняя их новой формой, гармонией и оркестровкой.',
      'https://www.thefirsthymnmovie.com/',
      'Официальный проект',
    )],
    techniques: [
      'Сохранившийся текст переводится и расширяется до современной песенной формы.',
      'Мелодические элементы папируса помещаются в тональную гармонию и регулярный метр.',
      'Новые куплеты и припев отделены от того, что действительно сохранилось в P.Oxy. 1786.',
    ],
    laterTrace: [
      'Проект включает документальный фильм и концертное исполнение современной версии.',
      'Песня выпущена в 2025 году и сопровождается отдельными материалами с исходной нотацией и переводом.',
    ],
    sources: [
      {
        label: 'The First Hymn',
        reference: 'Официальный проект: история P.Oxy. 1786 и процесс превращения древней мелодии в современную песню',
        url: 'https://www.thefirsthymnmovie.com/',
        kind: 'Первичный источник',
      },
      {
        label: 'Chris Tomlin & Ben Fielding Bring 1800 Year Old Hymn Back To Life',
        reference: 'Официальная публикация Chris Tomlin: использование оригинальных 35 слов и музыки папируса',
        url: 'https://christomlin.com/blogs/news/chris-tomlin-ben-fielding-bring-1800-year-old-hymn-back-to-life',
        kind: 'Первичный источник',
      },
      {
        label: 'An Ancient Christian Hymn with Musical Notation',
        reference: 'Charles H. Cosgrove, научное исследование текста, нотации и контекста P.Oxy. 1786',
        url: 'https://www.mohrsiebeck.com/en/book/an-ancient-christian-hymn-with-musical-notation-9783161509230/',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'josquin-praeter-rerum-seriem',
    title: 'Praeter rerum seriem: Josquin → Rore',
    type: 'Мотет-модель / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Связь прямо указана в каталогах и подтверждена исследованиями репертуара Rore.',
    summary: 'Cipriano de Rore строит шестиголосную мессу на материале мотета Josquin. К полифоническим комплексам модели он добавляет рождественский хоральный cantus firmus, соединяя память о Josquin с собственной плотной фактурой.',
    model: {
      composerId: 'des-prez-josquin',
      composer: 'Жоскен Депре',
      title: 'Praeter rerum seriem, NJE 24.11',
      catalogEntries: [{ artistId: 'josquin', workId: '811449' }],
    },
    reuses: [
      {
        composerId: 'rore-cipriano-de',
        composer: 'Чиприано де Роре',
        title: 'Missa Praeter rerum seriem',
        catalogEntries: [{ artistId: 'rore-cipriano-de', workId: '680649' }],
        relation: 'Шестиголосная имитационная месса',
        evidence: 'Заимствованы многоголосные комплексы мотета; поверх них введён литургический cantus firmus.',
      },
    ],
    techniques: [
      'Перенос нескольких голосов модели вместо одной изолированной мелодии.',
      'Перестановка и новое соединение имитационных входов в частях ординария.',
      'Добавление хорального cantus firmus создаёт второй исторический слой.',
    ],
    laterTrace: [
      'Orlande de Lassus — Magnificat secundi toni, LV 1070: ещё одна крупная композиция на модели Josquin.',
      'Месса Rore закрепляет Josquin как историческую модель при дворе Эрколе II д’Эсте в Ферраре.',
    ],
    sources: [
      {
        label: 'Who was Cipriano de Rore?',
        reference: 'Jessie Ann Owens, UC Davis Arts, раздел о Missa Praeter rerum seriem',
        url: 'https://arts.ucdavis.edu/pod/who-was-cipriano-de-rore',
        kind: 'Исследование',
      },
      {
        label: 'Cipriano de Rore — Dizionario Biografico',
        reference: 'Treccani: месса на мотете Josquin и феррарский контекст',
        url: 'https://www.treccani.it/enciclopedia/cipriano-de-rore_%28Dizionario-Biografico%29/',
        kind: 'Научный справочник',
      },
      {
        label: 'Missa Praeter rerum seriem',
        reference: 'Каталог IMSLP: модель Josquin и связанный Magnificat Lassus',
        url: 'https://imslp.org/wiki/Missa_Praeter_rerum_seriem_%28Rore%2C_Cipriano_de%29',
        kind: 'Каталог источников',
      },
    ],
  },
  {
    id: 'josquin-benedicta-es',
    title: 'Benedicta es: Josquin → Palestrina',
    type: 'Мотет-модель / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Модель Josquin согласованно названа в справочной и аналитической литературе о мессе Palestrina.',
    summary: 'Palestrina разворачивает материал шестиголосного мотета Josquin в полном цикле мессы. Особенно заметным опознавательным элементом становится мотив на словах «Te Deus Pater», который возвращается в разных разделах.',
    model: {
      composerId: 'des-prez-josquin',
      composer: 'Жоскен Депре',
      title: 'Benedicta es, coelorum regina, NJE 23.13',
      catalogEntries: [{ artistId: 'josquin', workId: '961354' }],
    },
    reuses: [
      {
        composerId: 'palestrina-giovanni-pierluigi-da',
        composer: 'Джованни Пьерлуиджи да Палестрина',
        title: 'Missa Benedicta es, PdPWV Mis100',
        catalogEntries: [{ artistId: 'palestrina-giovanni-pierluigi-da', workId: '1312548' }],
        relation: 'Имитационная месса',
        evidence: 'Характерные мотивы и голосовые сочетания мотета используются как строительный материал частей мессы.',
      },
    ],
    techniques: [
      'Цитатный мотив сохраняет узнаваемый интервальный профиль.',
      'Многоголосные фрагменты модели распределены по новым текстовым разделам.',
      'Каденции и плотность фактуры приспособлены к собственной манере Palestrina.',
    ],
    laterTrace: [
      'Orlande de Lassus — Magnificat на той же модели.',
      'Jean Guyot — двенадцатиголосная переработка мотета.',
      'К модели обращались также Cristóbal de Morales и другие авторы месс XVI века.',
    ],
    sources: [
      ...palestrinaSources,
      {
        label: 'Palestrina: Missa Benedicta es',
        reference: 'Hyperion: аналитическая заметка о мотиве «Te Deus Pater»',
        url: 'https://www.hyperion-records.co.uk/dc.asp?dc=D_CDGIM001',
        kind: 'Исследование',
      },
      {
        label: 'Sacred Music, vol. 147, no. 2',
        reference: 'Church Music Association of America: рецепция мотета Josquin у Guyot, Lassus, Palestrina и Morales',
        url: 'https://media.churchmusicassociation.org/publications/sacredmusic/pdf/sm147-2.pdf',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'quando-lieta-sperai-network',
    title: 'Quando lieta sperai: спорная модель и четыре ветви',
    type: 'Мадригал-модель / сеть имитаций',
    certainty: 'disputed',
    certaintyNote: 'Модель долго приписывали Rore; часть современной литературы считает почти несомненным автором Cristóbal de Morales. Связи с последующими мессами и Magnificat подтверждены.',
    summary: 'Один из наиболее показательных случаев распространения светской модели XVI века. Мадригал был напечатан без имени в сборнике Rore, позднее фигурировал под его именем, а версия для лютни Vincenzo Galilei называет Morales. На этой музыке построены мессы Andrea Gabrieli, Palestrina и Philippe de Monte, а также Magnificat Lassus.',
    model: {
      composerId: 'rore-cipriano-de',
      composer: 'Чиприано де Роре / Кристобаль де Моралес (атрибуция спорна)',
      title: 'Quando lieta sperai',
      date: 'опубликовано без атрибуции в 1549; позднейшая атрибуция Morales — 1584',
      catalogEntries: [{ artistId: 'rore-cipriano-de', workId: '961631' }],
    },
    reuses: [
      {
        composerId: 'gabrieli-andrea',
        composer: 'Андреа Габриели',
        title: 'Missa Quando lieta sperai',
        date: 'напечатана в 1572',
        catalogEntries: [{ artistId: 'gabrieli-andrea', workId: '792946' }],
        relation: 'Шестиголосная имитационная месса',
        evidence: 'Название и музыкальный материал указывают на Quando lieta sperai как модель.',
      },
      {
        composerId: 'palestrina-giovanni-pierluigi-da',
        composer: 'Джованни Пьерлуиджи да Палестрина',
        title: 'Missa Quando lieta sperai, PdPWV Mis068',
        catalogEntries: [{ artistId: 'palestrina-giovanni-pierluigi-da', workId: '305676' }],
        relation: 'Имитационная месса',
        evidence: 'Мадригальная модель входит в документированный корпус месс Palestrina на произведения других авторов.',
      },
    ],
    techniques: [
      'Светский многоголосный материал переносится в литургический цикл.',
      'Авторы выбирают разные фрагменты одной модели и разворачивают их независимо.',
      'История атрибуции показывает, что сеть влияния может быть надёжнее имени автора модели.',
    ],
    laterTrace: [
      'Philippe de Monte — Missa Quando lieta sperai.',
      'Orlande de Lassus — Magnificat Quando lieta sperai, рукопись-подарок герцогу Wilhelm, датированная 23 декабря 1580 года.',
      'Vincenzo Galilei — лютневая версия в Contrapunti (1584), важная для атрибуции мадригала Morales.',
    ],
    sources: [
      {
        label: 'Nassarre 27 (2011)',
        reference: 'Revista Aragonesa de Musicología, pp. 91–130: атрибуция Morales и перечень четырёх производных сочинений',
        url: 'https://ifc.dpz.es/recursos/publicaciones/32/62/_ebook.pdf',
        kind: 'Исследование',
      },
      {
        label: 'Orlandus Lassus: The Alchemist, vol. 1',
        reference: 'Примечания к записи: рукопись Magnificat 1580 года и мессы Gabrieli, Palestrina, de Monte',
        url: 'https://www.eclassical.com/shop/17115/art9/5120409-fc6cf7-0691062066020_01.pdf',
        kind: 'Исследование',
      },
      ...palestrinaSources.slice(0, 1),
    ],
  },
  {
    id: 'hassler-dixit-maria',
    title: 'Dixit Maria: Hassler → Hassler',
    type: 'Самозаимствование / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Месса последовательно описывается как основанная на собственном мотете Hassler.',
    summary: 'Hassler использует мотивы четырёхголосного мотета Dixit Maria ad angelum как основу мессы. Начальные жесты и имитационные входы переходят в более протяжённые разделы ординария.',
    model: {
      composerId: 'hassler-hans-leo',
      composer: 'Ханс Лео Хасслер',
      title: 'Dixit Maria ad angelum',
      catalogEntries: [{ artistId: 'hassler-hans-leo', workId: '271246' }],
    },
    reuses: [
      {
        composerId: 'hassler-hans-leo',
        composer: 'Ханс Лео Хасслер',
        title: 'Missa prima super Dixit Maria',
        catalogEntries: [{ artistId: 'hassler-hans-leo', workId: '919416' }],
        relation: 'Имитационная месса на собственный мотет',
        evidence: 'Тематические группы мотета служат исходным материалом мессы.',
      },
    ],
    techniques: [
      'Перенос начальных имитационных входов.',
      'Расширение краткой мотетной модели до пяти частей ординария.',
      'Перегруппировка голосов при сохранении узнаваемых контуров.',
    ],
    laterTrace: [
      'Произведение сохраняется в хоровом репертуаре как наглядный пример немецкой имитационной мессы конца XVI века.',
      'Связка мотет—месса позволяет сопоставлять один материал в краткой и крупной формах.',
    ],
    sources: [
      {
        label: 'Graduate Conducting Recital Program',
        reference: 'Texas Christian University, 2020: программа и аналитическая заметка к Agnus Dei',
        url: 'https://finearts.tcu.edu/music/wp-content/uploads/sites/5/2020/11/Graduate-Conducting-Recital-Program-F20.pdf',
        kind: 'Исследование',
      },
      {
        label: 'Missa prima super Dixit Maria',
        reference: 'IMSLP: запись произведения и печатные источники',
        url: 'https://imslp.org/wiki/Missa_prima_super_Dixit_Maria_%28Hassler%2C_Hans_Leo%29',
        kind: 'Каталог источников',
      },
    ],
  },
  {
    id: 'marenzio-iniquos-odio-habui',
    title: 'Iniquos odio habui: Marenzio → месса спорного авторства',
    type: 'Мотет-модель / имитационная месса',
    certainty: 'disputed',
    certaintyNote: 'Модель Marenzio установлена, но автор мессы спорен: гданьские рукописи называют Marenzio, печать — Georg Vintz.',
    summary: 'Восьмиголосный двуххорный мотет Marenzio служит моделью мессы. Исследование источников отделяет надёжную музыкальную связь от нерешённого вопроса авторства производного произведения.',
    model: {
      composerId: 'marenzio-luca',
      composer: 'Лука Маренцио',
      title: 'Iniquos odio habui',
      catalogEntries: [
        { artistId: 'marenzio', workId: '719632' },
        { artistId: 'marenzio-luca', workId: '719632' },
      ],
    },
    reuses: [
      {
        composerId: 'marenzio-luca',
        composer: 'Лука Маренцио / Георг Винц (атрибуция спорна)',
        title: 'Missa super iniquos odio habui',
        catalogEntries: [
          { artistId: 'marenzio', workId: '719650' },
          { artistId: 'marenzio-luca', workId: '719650' },
        ],
        relation: 'Восьмиголосная имитационная месса',
        evidence: 'Музыкальная модель — мотет Marenzio; разные источники по-разному называют автора самой мессы.',
      },
    ],
    techniques: [
      'Сохранение двуххорного принципа исходного мотета.',
      'Обмен репликами между хорами и крупные эхо-эффекты.',
      'Свободная переработка модели в Gloria показывает, что связь не сводится к буквальному копированию.',
    ],
    laterTrace: [
      'Печатная версия в собрании Georg Vintz и две гданьские рукописи передают близкий материал с разной атрибуцией.',
      'Случай показывает типичную проблему: имя над мессой могло обозначать автора модели, а не автора переработки.',
    ],
    sources: [
      {
        label: 'Studies in Sixteenth- and Seventeenth-Century Italian Sacred Music',
        reference: 'Barbara Przybyszewska-Jarmińska: источники, двуххорная техника и проблема Marenzio/Vintz',
        url: 'https://mi.pl/pl/p/file/7098f6494c7027531f4faa932a438ba1/Toffetti_Studies.pdf',
        kind: 'Исследование',
      },
      {
        label: 'Missa super Iniquos odio habui — critical edition',
        reference: 'Institute of Art, Polish Academy of Sciences: полное издание и описание missa ad imitationem',
        url: 'https://www.ispan.pl/sites/default/files/marenzio_missa_super_iniquos_odio_habui.pdf',
        kind: 'Первичный источник',
      },
    ],
  },
  victoriaRecord(
    'victoria-o-magnum-mysterium',
    '46230',
    'O magnum mysterium',
    '43328',
    'Missa O magnum mysterium',
    'Исследования показывают перенос начального комплекса и фразы, связанной с «Alleluia», в несколько частей мессы.',
    ['Перенос начального имитационного комплекса.', 'Возврат контрастного материала «Alleluia».', 'Перекомпоновка исходных фраз в новых тональных и текстовых условиях.'],
  ),
  victoriaRecord(
    'victoria-o-quam-gloriosum',
    '46234',
    'O quam gloriosum est regnum',
    '43335',
    'Missa O quam gloriosum',
    'Месса использует внутренние разделы мотета и варьирует его линии, а не ограничивается начальной темой.',
    ['Выбор материала из разных участков мотета.', 'Варьирование голосовых линий.', 'Новые сочетания исходных многоголосных блоков.'],
  ),
  victoriaRecord(
    'victoria-ascendens-christus',
    '229350',
    'Ascendens Christus in altum',
    '43254',
    'Missa Ascendens Christus in altum',
    'Одноимённый мотет входит в документированный список семи собственных моделей Victoria.',
    ['Имитационное начало становится опознавательным материалом.', 'Полифонические блоки распределяются по разделам мессы.', 'Кадансовые формулы получают новый литургический контекст.'],
  ),
  victoriaRecord(
    'victoria-dum-complerentur',
    '666337',
    'Dum complerentur',
    '43284',
    'Missa Dum complerentur',
    'Одноимённый мотет указан как собственная модель мессы Victoria.',
    ['Использование ансамбля мотивов модели.', 'Сжатие и расширение имитационных участков.', 'Перераспределение мотивов между голосами.'],
  ),
  victoriaRecord(
    'victoria-trahe-me-post-te',
    '84215',
    'Trahe me post te',
    '43405',
    'Missa Trahe me post te',
    'Антифон/мотет Trahe me post te документирован как собственная модель мессы.',
    ['Парафразирование узнаваемых мелодических контуров.', 'Повторное использование многоголосной фактуры.', 'Адаптация исходного материала к протяжённости ординария.'],
  ),
  victoriaRecord(
    'victoria-quam-pulchri-sunt',
    '219616',
    'Quam pulchri sunt gressus tui',
    '43361',
    'Missa Quam pulchri sunt',
    'Quam pulchri sunt входит в устойчиво приводимый исследователями список собственных моделей Victoria.',
    ['Отбор мотивов из песнопения на текст Песни песней.', 'Переозвучивание в частях мессы.', 'Сохранение мягких имитационных связей исходной фактуры.'],
  ),
  victoriaRecord(
    'victoria-vidi-speciosam',
    '85840',
    'Vidi speciosam',
    '43412',
    'Missa Vidi speciosam',
    'Шестиголосный мотет документирован как модель одноимённой мессы.',
    ['Сохранение шестиголосной основы.', 'Перестановка имитационных вступлений.', 'Развёртывание коротких мотивов в масштабные разделы.'],
  ),
  {
    id: 'palestrina-assumpta-est-maria',
    title: 'Assumpta est Maria: Palestrina → Palestrina',
    type: 'Самозаимствование / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Мотет Assumpta est Maria указан в литературе и каталогах как собственная модель мессы.',
    summary: 'Palestrina использует собственный мотет как резерв тематических и многоголосных комплексов для мессы, сохраняя узнаваемость модели при изменении масштаба и литургического текста.',
    model: palestrinaWork('1296058', 'Assumpta est Maria, PdPWV Mot251'),
    reuses: [{
      ...palestrinaWork('120629', 'Missa Assumpta est Maria, PdPWV Mis101'),
      relation: 'Имитационная месса на собственный мотет',
      evidence: 'Каталог Palestrina связывает мессу с одноимённым мотетом; обзор жанра относит модель к его известным самозаимствованиям.',
    }],
    techniques: ['Перенос нескольких голосов модели.', 'Новая последовательность имитационных блоков.', 'Расширение каденционных планов для частей ординария.'],
    laterTrace: ['Мотет относится к группе собственных произведений, которые Palestrina повторно использовал как модели.', 'Практика продолжена в мессах на Dum complerentur, Dies sanctificatus, Hodie Christus natus est и других собственных мотетах.'],
    sources: palestrinaSources,
  },
  {
    id: 'palestrina-dum-complerentur',
    title: 'Dum complerentur: Palestrina → Palestrina',
    type: 'Самозаимствование / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Каталог произведений прямо называет собственный мотет моделью мессы.',
    summary: 'Мотет Dum complerentur становится полифонической моделью одноимённой мессы Palestrina. Композитор переносит не одну мелодию, а взаимодействие голосов и характерные точки имитации.',
    model: palestrinaWork('1290965', 'Dum complerentur, PdPWV Mot059'),
    reuses: [{
      ...palestrinaWork('1303654', 'Missa Dum complerentur, PdPWV Mis052'),
      relation: 'Имитационная месса на собственный мотет',
      evidence: 'Название, тематический материал и каталожное описание связывают мессу с мотетом.',
    }],
    techniques: ['Повторное использование многоголосных комплексов.', 'Перенос мотивов между голосами.', 'Адаптация имитаций к новому тексту.'],
    laterTrace: ['Связь входит в большую группу из двадцати двух имитационных месс Palestrina на собственные произведения, подсчитанную в обзорной литературе.', 'Сопоставима с его мессами Assumpta est Maria и Già fù chi m’ebbe cara, также отмеченными в каталоге.'],
    sources: palestrinaSources,
  },
  {
    id: 'palestrina-gia-fu-chi-mebbe-cara',
    title: 'Già fu chi m’ebbe cara: Palestrina → Palestrina',
    type: 'Мадригал-модель / самозаимствование',
    certainty: 'documented',
    certaintyNote: 'Светский мадригал назван в литературе среди собственных моделей имитационных месс Palestrina.',
    summary: 'Palestrina переносит многоголосный материал собственного мадригала в литургическую мессу. Случай важен тем, что источником служит светское произведение самого композитора.',
    model: palestrinaWork('1298102', 'Già fu chi m’ebbe cara, PdPWV Mad011'),
    reuses: [{
      ...palestrinaWork('1305042', 'Missa Già fù chi m’ebbe cara, PdPWV Mis061'),
      relation: 'Имитационная месса на собственный мадригал',
      evidence: 'Месса сохраняет заглавие мадригала-модели; связь входит в классификацию самозаимствований Palestrina.',
    }],
    techniques: ['Перенос светской многоголосной ткани в сакральный жанр.', 'Изменение масштаба и текстовой артикуляции.', 'Повторное комбинирование голосовых фрагментов.'],
    laterTrace: ['Palestrina использовал как модели и другие собственные мадригалы: Io son ferito для Missa Petra sancta и Vestiva i colli.', 'Этот ряд показывает, как популярный мадригальный материал продолжал жизнь в мессе.'],
    sources: palestrinaSources,
  },
  {
    id: 'janequin-la-bataille',
    title: 'La bataille: Janequin → месса спорного авторства',
    type: 'Шансон-модель / имитационная месса',
    certainty: 'disputed',
    certaintyNote: 'Связь музыки с шансон Janequin установлена, но современное исследование считает авторство мессы Janequin сомнительным и предлагает Francesco Layolle.',
    summary: 'Знаменитая батальная шансон La guerre / La bataille de Marignan стала тематической основой мессы. Старые каталоги закрепили мессу за Janequin, тогда как новое исследование источников отделяет модель Janequin от вероятного автора переработки — Francesco Layolle.',
    model: {
      composerId: 'janequin-clement',
      composer: 'Клеман Жанекен',
      title: 'La bataille de Marignan',
      catalogEntries: [{ artistId: 'janequin', workId: '128063' }],
    },
    reuses: [{
      composerId: 'janequin-clement',
      composer: 'Клеман Жанекен / Франческо Лайолле (атрибуция спорна)',
      title: 'Missa super La bataille',
      date: 'печатный источник 1532 года',
      catalogEntries: [{ artistId: 'janequin', workId: '492039' }],
      relation: 'Имитационная месса на батальную шансон',
      evidence: 'Тематическая зависимость от шансон признаётся; авторство самой мессы пересмотрено.',
    }],
    techniques: ['Перенос характерных сигнальных и ритмических фигур шансон.', 'Преобразование изобразительной светской модели в литургические части.', 'Расширение коротких формул средствами имитации.'],
    laterTrace: ['La bataille породила широкую традицию обработок и инструментальных транскрипций XVI века.', 'Missa super La bataille — один из ранних примеров крупной сакральной переработки этой модели.'],
    sources: [
      {
        label: 'La Guerre ou La Bataille de Marignan',
        reference: 'Université Toulouse — Musique de la Renaissance: шансон как тематическая основа мессы',
        url: 'https://blogs.univ-tlse2.fr/musique-renaissance/instruments-voix/la-guerre-ou-la-bataille-de-marignan/',
        kind: 'Исследование',
      },
      {
        label: 'The “Contagion” of Masses',
        reference: 'Clément Janequin research project: критика атрибуции и гипотеза Francesco Layolle',
        url: 'https://www.clement-janequin.com/authenticity-studies/contagion/',
        kind: 'Исследование',
      },
      {
        label: 'Missa super La bataille — BnF',
        reference: 'Bibliothèque nationale de France: библиографическая запись печати 1532 года',
        url: 'https://catalogue.bnf.fr/ark:/12148/cb13982412c',
        kind: 'Каталог источников',
      },
    ],
  },
  {
    id: 'monteverdi-in-illo-tempore',
    title: 'In illo tempore: Gombert → Monteverdi',
    type: 'Мотет-модель / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Само издание 1610 года называет мотет Gombert и печатает перед мессой десять заимствованных мотивов.',
    summary: 'Monteverdi открывает издание 1610 года шестиголосной мессой на мотете Nicolas Gombert 1539 года. Композитор не скрывает модель: перед мессой напечатаны десять fughe — кратких мотивов, которые затем подвергаются обращению, ракоходу и новым контрапунктическим сочетаниям.',
    model: {
      composerId: 'gombert-nicolas',
      composer: 'Николя Гомберт',
      title: 'In illo tempore loquente Jesu',
      date: '1539',
    },
    reuses: [{
      composerId: 'monteverdi-claudio',
      composer: 'Клаудио Монтеверди',
      title: 'Missa In illo tempore, SV 205',
      date: '1610',
      catalogEntries: [
        { artistId: 'monteverdi', workId: '752406' },
        { artistId: 'monteverdi-claudio', workId: '752406' },
      ],
      relation: 'Шестиголосная имитационная месса',
      evidence: 'Первопечатное издание прямо называет Gombert и показывает десять исходных мотивов перед началом мессы.',
    }],
    techniques: ['Прямое объявление десяти fughe из модели.', 'Оригинальная форма, обращение, ракоход и ракоходное обращение мотивов.', 'Смещение опоры полифонии от тенора к басу и переосмысление модального плана.'],
    laterTrace: ['Месса стала демонстрацией владения stile antico в момент формирования seconda pratica.', 'Печатная таблица мотивов делает эту связь одним из редких случаев, где сам композитор оставил карту собственных заимствований.'],
    sources: [
      {
        label: 'Monteverdi 1610, catalogue and facsimile description',
        reference: 'Society for Seventeenth-Century Music: описание первопечатного издания и десяти мотивов Gombert',
        url: 'https://sscm-jscm.org/instrumenta/vol-2/catalogue/Monteverdi%201610%20M3445.pdf',
        kind: 'Первичный источник',
      },
      {
        label: 'Monteverdi’s Mass and Vespers of 1610',
        reference: 'Journal of Seventeenth-Century Music, vol. 18 no. 1: контекст и модель Gombert',
        url: 'https://sscm-jscm.org/jscm-issues/volume-18-no-1/monteverdis-mass-and-vespers-of-1610-the-economic-social-and-courtly-context/',
        kind: 'Исследование',
      },
      {
        label: 'Is Modality still a Compositional Tool in Monteverdi’s 1610 Mass?',
        reference: 'Marco Mangani, Daniele Sabaino, Musurgia XXVI/2 (2019), pp. 95–118',
        url: 'https://flore.unifi.it/handle/2158/1174976',
        kind: 'Исследование',
      },
    ],
  },
  {
    id: 'tallis-salve-intemerata',
    title: 'Salve intemerata: Tallis → Tallis',
    type: 'Антифон-модель / имитационная месса',
    certainty: 'documented',
    certaintyNote: 'Книга Kerry McCarthy о Tallis и научные справочники прямо называют собственный антифон моделью мессы.',
    summary: 'Tallis возвращается к собственному масштабному антифону Salve intemerata и превращает его материал в пятиголосную мессу. Степень зависимости меняется по ходу цикла: Gloria почти целиком опирается на модель, тогда как в последующих частях растёт доля новой музыки.',
    model: {
      composerId: 'tallis-thomas',
      composer: 'Томас Таллис',
      title: 'Salve intemerata Virgo Maria',
      catalogEntries: [
        { artistId: 'tallis', workId: '1322495' },
        { artistId: 'tallis-thomas', workId: '1322495' },
      ],
    },
    reuses: [{
      composerId: 'tallis-thomas',
      composer: 'Томас Таллис',
      title: 'Missa Salve intemerata',
      catalogEntries: [
        { artistId: 'tallis', workId: '1322430' },
        { artistId: 'tallis-thomas', workId: '1322430' },
      ],
      relation: 'Пятиголосная имитационная месса на собственный антифон',
      evidence: 'В Gloria преобладают близкие цитаты с ритмической адаптацией текста; Credo, Sanctus и Agnus Dei постепенно вводят больше свободного материала.',
    }],
    techniques: [
      'Близкое повторное использование голосов антифона в Gloria.',
      'Ритмическая переделка материала под новый латинский текст.',
      'Постепенное ослабление зависимости от модели: от преимущественной цитаты к свободно сочинённым участкам.',
    ],
    laterTrace: [
      'Утраченную теноровую партию мессы можно уверенно восстанавливать там, где цитата антифона буквальна.',
      'Исследователи сопоставляют метод Tallis с более ранними английскими парами антифон—месса у Robert Fayrfax и John Taverner.',
    ],
    sources: [
      {
        label: 'The Peterhouse Partbooks',
        reference: 'Kerry McCarthy, Tallis, Oxford University Press, 2020, chapter 10, pp. 113–122',
        url: 'https://academic.oup.com/book/36973/chapter-abstract/322289906',
        kind: 'Исследование',
      },
      {
        label: 'Thomas Tallis — Polish Music Library',
        reference: 'Энциклопедическая статья: Missa Salve intemerata как пятиголосная месса ad imitationem',
        url: 'https://polskabibliotekamuzyczna.pl/encyklopedia/tallis-thomas/',
        kind: 'Научный справочник',
      },
      {
        label: 'The Peterhouse partbooks — analytical chapter',
        reference: 'Nick Sandon: анализ распределения материала антифона по частям мессы и реконструкции утраченного тенора',
        url: 'https://www.diamm.ac.uk/documents/44/Sandon34.pdf',
        kind: 'Исследование',
      },
      {
        label: 'Salve intemerata virgo Maria — DIAMM',
        reference: 'Digital Image Archive of Medieval Music: рукописные источники антифона Tallis',
        url: 'https://www.diamm.ac.uk/compositions/87923/',
        kind: 'Каталог источников',
      },
    ],
  },
]

export function quotationRecordsForWork(artistId: string, workId: string) {
  return quotationRecords.filter((record) => {
    const works = [record.model, ...record.reuses]
    return works.some((work) => work.catalogEntries?.some((entry) => (
      entry.artistId === artistId && entry.workId === workId
    )))
  })
}

export function quotationRecordsForArtist(artistId: string) {
  return quotationRecords.filter((record) => (
    [record.model, ...record.reuses].some((work) => (
      work.catalogEntries?.some((entry) => entry.artistId === artistId)
    ))
  ))
}

export function quotationRoleForWork(record: QuotationRecord, artistId: string, workId: string) {
  const isModel = record.model.catalogEntries?.some((entry) => entry.artistId === artistId && entry.workId === workId)
  return isModel ? 'ИСТОЧНИК' : 'ЦИТАТА'
}
