export type TrackMediaType = 'midi' | 'audio'

export interface TrackData {
  id: string
  title: string
  number: number
  duration: string
  key: string
  bpm: number
  meter: string
  mediaType: TrackMediaType
  mediaUrl: string
  scoreUrl: string
  sourceName: string
  sourceUrl: string
  license: string
  qualityLabel: string
}

export interface AlbumData {
  id: string
  title: string
  year: number
  type: string
  variant: number
  tracks: TrackData[]
}

export interface ArtistCardData {
  id: string
  name: string
  monogram: string
  genre: string
  origin: string
  year: string
  variant: number
  biography: string[]
  albums: AlbumData[]
}

interface ComposerSeed extends Omit<ArtistCardData, 'albums'> {
  collection: string
  work: Omit<TrackData, 'id' | 'number' | 'mediaUrl' | 'scoreUrl' | 'qualityLabel'> & {
    year: number
    mediaExtension?: 'ogg'
  }
}

const mutopiaSource = 'https://www.mutopiaproject.org/'

const composerSeeds: ComposerSeed[] = [
  {
    id: 'allegri', name: 'Грегорио Аллегри', monogram: 'GA', genre: 'Римская школа', origin: 'Рим / Италия', year: 'ок. 1582–1652', variant: 1,
    biography: [
      'Грегорио Аллегри — итальянский певец и композитор позднего Возрождения и раннего барокко. Он служил в папской капелле в Риме и писал главным образом духовную хоровую музыку.',
      'Самое известное произведение Аллегри — девятиголосный псалом Miserere mei, Deus. Пространственное чередование двух хоров и орнаментированная верхняя партия сделали его одним из символов римской церковной полифонии.',
    ],
    collection: 'Miserere',
    work: { title: 'Miserere mei, Deus', year: 1638, duration: '5:16', key: 'B♭m', bpm: 60, meter: '4 / 2', mediaType: 'audio', mediaExtension: 'ogg', sourceName: 'Wikimedia Commons / Mutopia Project', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Allegri_-_Miserere_Mei,_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_(audio).ogg', license: 'Audio CC BY 3.0 / score CC BY-SA 4.0' },
  },
  {
    id: 'arbeau', name: 'Туано Арбо', monogram: 'TA', genre: 'Танцевальная музыка', origin: 'Дижон / Франция', year: '1519–1595', variant: 2,
    biography: [
      'Туано Арбо — литературный псевдоним французского священника Жеана Табуро. Его трактат «Орхезография» 1589 года подробно описывает танцы, музыку и правила поведения на балу XVI века.',
      'Диалоговый текст трактата сопровождают мелодии и схемы движений. Павана Belle qui tiens ma vie стала самой узнаваемой музыкальной страницей книги и важным источником по практике французского танца.',
    ],
    collection: 'Орхезография',
    work: { title: 'Belle qui tiens ma vie', year: 1589, duration: '0:24', key: 'F', bpm: 160, meter: '2 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'dowland', name: 'Джон Доуленд', monogram: 'JD', genre: 'Английская лютня', origin: 'Лондон / Англия', year: '1563–1626', variant: 3,
    biography: [
      'Джон Доуленд — английский лютнист и автор песен, работавший при дворах Европы и позднее при дворе Якова I. Его музыка соединяет ясную вокальную линию с самостоятельной, тонко разработанной партией лютни.',
      'Доуленд особенно известен меланхолическими песнями и паванами, однако Come Again показывает и более лёгкую сторону его стиля. Песня была опубликована в Первой книге песен в 1597 году.',
    ],
    collection: 'Первая книга песен',
    work: { title: 'Come Again', year: 1597, duration: '0:31', key: 'C', bpm: 200, meter: '4 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'galilei', name: 'Винченцо Галилей', monogram: 'VG', genre: 'Флорентийская камерата', origin: 'Флоренция / Италия', year: 'ок. 1520–1591', variant: 4,
    biography: [
      'Винченцо Галилей — итальянский лютнист, теоретик музыки и участник Флорентийской камераты. Он выступал за ясность текста и выразительную одноголосную декламацию, подготовив почву для появления ранней оперы.',
      'Галилей исследовал строй и акустику экспериментально, связывая музыкальную практику с наблюдением. Его танцевальные пьесы для лютни сохраняют ритмическую энергию и прозрачность фактуры Возрождения.',
    ],
    collection: 'Музыка для лютни',
    work: { title: 'Saltarello', year: 1584, duration: '1:06', key: 'D', bpm: 96, meter: '3 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'gastoldi', name: 'Джованни Гастольди', monogram: 'GG', genre: 'Итальянский мадригал', origin: 'Мантуя / Италия', year: 'ок. 1554–1609', variant: 5,
    biography: [
      'Джованни Джакомо Гастольди — итальянский композитор и капельмейстер, связанный с двором Гонзага в Мантуе. Он писал духовную музыку, мадригалы и лёгкие танцевальные песни.',
      'Его баллетто строятся на чётком ритме, повторяющихся разделах и слоговых припевках. Эта доступная форма быстро распространилась по Европе и повлияла на английских мадригалистов.',
    ],
    collection: 'Мадригалы на шесть голосов',
    work: { title: "Al mormorar de' liquidi cristalli", year: 1594, duration: '2:36', key: 'C', bpm: 120, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'gesualdo', name: 'Карло Джезуальдо', monogram: 'CG', genre: 'Поздний мадригал', origin: 'Веноза / Италия', year: '1566–1613', variant: 2,
    biography: [
      'Карло Джезуальдо, князь Венозы, — итальянский композитор позднего Возрождения. Его мадригалы отличаются смелой хроматикой, резкими гармоническими сдвигами и предельно внимательной передачей поэтического текста.',
      'Шестая книга мадригалов 1611 года доводит этот язык до крайней выразительности. Dolcissima mia vita противопоставляет нежные обращения внезапным диссонансам и паузам.',
    ],
    collection: 'Шестая книга мадригалов',
    work: { title: 'Dolcissima mia vita', year: 1611, duration: '2:38', key: 'F', bpm: 100, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'gibbons', name: 'Орландо Гиббонс', monogram: 'OG', genre: 'Английская полифония', origin: 'Оксфорд / Англия', year: '1583–1625', variant: 4,
    biography: [
      'Орландо Гиббонс — английский органист, верджиналист и композитор переходной эпохи между Возрождением и барокко. Он служил в Королевской капелле и Вестминстерском аббатстве.',
      'Гиббонс писал церковные антемы, фантазии для виол и светские мадригалы. The Silver Swan сочетает сдержанную полифонию с выразительным образом лебединой песни.',
    ],
    collection: 'Первая книга мадригалов',
    work: { title: 'The Silver Swan', year: 1612, duration: '0:50', key: 'F', bpm: 100, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'janequin', name: 'Клеман Жанекен', monogram: 'CJ', genre: 'Французская шансон', origin: 'Шательро / Франция', year: 'ок. 1485–1558', variant: 1,
    biography: [
      'Клеман Жанекен — французский композитор, прославившийся программными многоголосными шансонами. В них голоса имитируют звуки битвы, охоты, улицы и птичьего пения.',
      'Le Chant des Oyseaux — виртуозная звуковая картина весны. Быстрые повторения слогов и переклички голосов превращают хор в ансамбль условных птичьих голосов.',
    ],
    collection: 'Парижские шансоны',
    work: { title: 'Le Chant des Oyseaux', year: 1529, duration: '7:06', key: 'Fm', bpm: 240, meter: '2 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'japart', name: 'Йоханнес Япарт', monogram: 'JJ', genre: 'Франко-фламандская школа', origin: 'Пикардия / Франция', year: 'работал ок. 1474–1507', variant: 3,
    biography: [
      'Йоханнес Япарт — франко-фламандский композитор, работавший при итальянских дворах Милана и Феррары. Сведения о его жизни редки, но произведения широко расходились в печатных сборниках начала XVI века.',
      'Япарт особенно любил комбинировать уже известные мелодии в плотной полифонической ткани. Tmeiskin сохранилась как короткая четырёхголосная пьеса в ранних нотопечатных изданиях.',
    ],
    collection: 'Ранние печатные сборники',
    work: { title: 'Tmeiskin', year: 1501, duration: '0:59', key: 'Fm', bpm: 196, meter: '2 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'lassus', name: 'Орландо ди Лассо', monogram: 'OL', genre: 'Франко-фламандская школа', origin: 'Монс / Фландрия', year: 'ок. 1532–1594', variant: 5,
    biography: [
      'Орландо ди Лассо — один из самых универсальных композиторов XVI века. После работы в Италии он возглавил капеллу баварских герцогов в Мюнхене и создавал музыку на латинские, французские, итальянские и немецкие тексты.',
      'Его наследие охватывает мессы, мотеты, мадригалы и песни. Sibylla Samia входит в цикл «Пророчества сивилл», известный необычной для своего времени хроматикой.',
    ],
    collection: 'Пророчества сивилл',
    work: { title: 'Sibylla Samia', year: 1600, duration: '2:40', key: 'F', bpm: 60, meter: '2 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'marenzio', name: 'Лука Маренцио', monogram: 'LM', genre: 'Итальянский мадригал', origin: 'Брешиа / Италия', year: 'ок. 1553–1599', variant: 4,
    biography: [
      'Лука Маренцио — итальянский композитор, один из ведущих мастеров мадригала конца XVI века. Он работал в Риме, Флоренции и при польском дворе, публикуя книги для разных вокальных составов.',
      'Маренцио переводил образы стихотворения в музыкальное движение, регистр и гармонию. Solo e pensoso на сонет Петрарки знаменит медленно поднимающейся хроматической линией верхнего голоса.',
    ],
    collection: 'Девятая книга мадригалов',
    work: { title: 'Solo e pensoso', year: 1599, duration: '4:38', key: 'C', bpm: 120, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'milan', name: 'Луис де Милан', monogram: 'LM', genre: 'Испанская виуэла', origin: 'Валенсия / Испания', year: 'ок. 1500–после 1560', variant: 1,
    biography: [
      'Луис де Милан — испанский композитор и исполнитель на виуэле. Его книга El Maestro 1536 года стала первым печатным сборником музыки для этого инструмента в Испании.',
      'В сборнике фантазии соседствуют с паванами и песнями. Милан подробно объяснял темп и манеру исполнения, поэтому издание остаётся важным практическим источником эпохи.',
    ],
    collection: 'El Maestro',
    work: { title: 'Pavana II', year: 1536, duration: '0:58', key: 'D', bpm: 150, meter: '3 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'philippe-de-monte', name: 'Филипп де Монте', monogram: 'PM', genre: 'Франко-фламандская школа', origin: 'Мехелен / Фландрия', year: '1521–1603', variant: 5,
    biography: [
      'Филипп де Монте — франко-фламандский композитор, большую часть карьеры проведший при дворе Габсбургов. С 1568 года он руководил императорской капеллой в Вене и Праге.',
      'Де Монте оставил более тысячи светских мадригалов, а также мессы и мотеты. Его письмо отличается плавной полифонией и внимательным следованием ритму итальянской поэзии.',
    ],
    collection: 'Мадригалы на три голоса',
    work: { title: 'Amor, che sol dei cor leggiadri ha cura', year: 1593, duration: '1:44', key: 'C', bpm: 120, meter: '2 / 2', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY 4.0' },
  },
  {
    id: 'josquin', name: 'Жоскен Депре', monogram: 'JD', genre: 'Высокое Возрождение', origin: 'Эно / Фландрия', year: 'ок. 1450–1521', variant: 2,
    biography: [
      'Жоскен Депре — центральная фигура франко-фламандской полифонии на рубеже XV и XVI веков. Он работал в Италии и Франции, а его мессы, мотеты и песни распространялись благодаря раннему нотопечатанию.',
      'Музыку Жоскена ценили за ясность структуры и выразительное обращение с текстом. El Grillo — короткая и остроумная фроттола, в которой повторяющиеся ритмы изображают стрекот сверчка.',
    ],
    collection: 'Светские песни',
    work: { title: 'El Grillo', year: 1505, duration: '1:43', key: 'C', bpm: 240, meter: '2 / 2', mediaType: 'audio', mediaExtension: 'ogg', sourceName: 'Wikimedia Commons / Mutopia Project', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Josquin_El_grillo_sung_by_the_dwsChorale.ogg', license: 'Audio CC BY-SA 3.0 / score Public Domain' },
  },
  {
    id: 'scheidemann', name: 'Генрих Шейдеман', monogram: 'HS', genre: 'Северонемецкая органная школа', origin: 'Вёрден / Германия', year: 'ок. 1595–1663', variant: 3,
    biography: [
      'Генрих Шейдеман — немецкий органист и композитор, ученик Яна Питерсзона Свелинка. Он десятилетиями работал в гамбургской церкви Святой Екатерины и стал одним из основателей северонемецкой органной школы.',
      'Его прелюдии, хоральные обработки и фантазии раскрывают тембровые возможности большого городского органа. Praeambulum no. 3 — компактный пример свободной клавирной формы.',
    ],
    collection: 'Органные преамбулы',
    work: { title: 'Praeambulum no. 3 in D', year: 1620, duration: '0:51', key: 'D', bpm: 90, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'Public Domain' },
  },
  {
    id: 'tallis', name: 'Томас Таллис', monogram: 'TT', genre: 'Английская полифония', origin: 'Кент / Англия', year: 'ок. 1505–1585', variant: 1,
    biography: [
      'Томас Таллис — английский композитор, чья карьера прошла при четырёх монархах и через несколько религиозных реформ. Он писал для латинской и английской литургии, сохраняя собственную ясную манеру голосоведения.',
      'If Ye Love Me — четырёхголосный антем на слова Евангелия от Иоанна. Простая слоговая фактура делает текст понятным, а имитационные вступления придают музыке внутреннее движение.',
    ],
    collection: 'Английские антемы',
    work: { title: 'If Ye Love Me', year: 1565, duration: '1:51', key: 'F', bpm: 70, meter: '4 / 4', mediaType: 'audio', mediaExtension: 'ogg', sourceName: 'Wikimedia Commons / Mutopia Project', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tallis_if_ye_love_me_performed_by_the_dwsChorale.ogg', license: 'Audio CC BY-SA 3.0 / score Public Domain' },
  },
  {
    id: 'victoria', name: 'Томас Луис де Виктория', monogram: 'TV', genre: 'Испанская полифония', origin: 'Авила / Испания', year: 'ок. 1548–1611', variant: 4,
    biography: [
      'Томас Луис де Виктория — испанский священник и композитор, крупнейший мастер духовной полифонии Испании. Он учился и работал в Риме, а затем служил при монастыре Дескальсас-Реалес в Мадриде.',
      'Виктория писал только духовную музыку, соединяя строгую полифонию с напряжённой выразительностью. Мотет O Magnum Mysterium впервые появился в печатном сборнике 1572 года.',
    ],
    collection: 'Motecta',
    work: { title: 'O Magnum Mysterium', year: 1572, duration: '2:34', key: 'A♭m', bpm: 110, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'monteverdi', name: 'Клаудио Монтеверди', monogram: 'CM', genre: 'Поздний мадригал', origin: 'Кремона / Италия', year: '1567–1643', variant: 2,
    biography: [
      'Клаудио Монтеверди — итальянский композитор, связавший полифоническую культуру Возрождения с новым языком барокко. Он работал при дворе Гонзага в Мантуе, а затем возглавил музыку собора Святого Марка в Венеции.',
      'В книгах мадригалов Монтеверди постепенно усиливал роль сольного голоса и инструментального баса. T’amo mia vita из Пятой книги строится вокруг выразительной декламации любовного текста.',
    ],
    collection: 'Пятая книга мадригалов',
    work: { title: "T'amo mia vita", year: 1605, duration: '2:24', key: 'C', bpm: 100, meter: '4 / 4', mediaType: 'midi', sourceName: 'Mutopia Project', sourceUrl: mutopiaSource, license: 'CC BY-SA 3.0' },
  },
  {
    id: 'frescobaldi', name: 'Джироламо Фрескобальди', monogram: 'GF', genre: 'Итальянская клавирная школа', origin: 'Феррара / Италия', year: '1583–1643', variant: 5,
    biography: [
      'Джироламо Фрескобальди — итальянский органист и один из главных мастеров клавирной музыки раннего барокко. Большую часть жизни он занимал должность органиста собора Святого Петра в Риме.',
      'Сборник Fiori musicali 1635 года объединяет органные пьесы для литургии. Toccata avanti la Messa della Domenica служит свободным вступлением к воскресной мессе и показывает гибкий, речевой ритм композитора.',
    ],
    collection: 'Fiori musicali',
    work: { title: 'Toccata avanti la Messa della Domenica', year: 1635, duration: '1:14', key: 'D', bpm: 72, meter: 'Свободный', mediaType: 'audio', mediaExtension: 'ogg', sourceName: 'Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frescobaldi_Toccata_avanti_la_Messa_della_Domenica.ogg', license: 'Audio CC BY 3.0 / score Public Domain' },
  },
  {
    id: 'praetorius', name: 'Михаэль Преториус', monogram: 'MP', genre: 'Немецкое Возрождение', origin: 'Кройцбург / Германия', year: '1571–1621', variant: 3,
    biography: [
      'Михаэль Преториус — немецкий композитор, органист и музыкальный теоретик. Он служил при дворе в Вольфенбюттеле и создал огромный корпус лютеранской церковной музыки.',
      'Преториус также оставил энциклопедический трактат Syntagma musicum и танцевальный сборник Terpsichore. Гармонизация Es ist ein Ros entsprungen стала одной из самых известных обработок рождественского хорала.',
    ],
    collection: 'Musae Sioniae',
    work: { title: 'Es ist ein Ros entsprungen', year: 1609, duration: '0:53', key: 'F', bpm: 76, meter: '4 / 4', mediaType: 'audio', mediaExtension: 'ogg', sourceName: 'Wikimedia Commons', sourceUrl: "https://commons.wikimedia.org/wiki/File:Michael_Praetorius_-_Es_ist_ein%27_Ros%27_entsprungen.ogg", license: 'Public Domain' },
  },
]

export const artists: ArtistCardData[] = composerSeeds.map((seed) => {
  const { collection, work, ...artist } = seed
  const mediaExtension = work.mediaExtension ?? 'mid'
  return {
    ...artist,
    albums: [{
      id: `${seed.id}-selected-works`,
      title: collection,
      year: work.year,
      type: 'Партитура',
      variant: seed.variant,
      tracks: [{
        id: `${seed.id}-${work.title.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'work'}`,
        number: 1,
        title: work.title,
        duration: work.duration,
        key: work.key,
        bpm: work.bpm,
        meter: work.meter,
        mediaType: work.mediaType,
        mediaUrl: `/classical/audio/${seed.id}.${mediaExtension}`,
        scoreUrl: `/classical/scores/${seed.id}.pdf`,
        sourceName: work.sourceName,
        sourceUrl: work.sourceUrl,
        license: work.license,
        qualityLabel: work.mediaType === 'audio' ? 'OGG / 44.1 KHZ' : 'MIDI / НОТНЫЙ РЕНДЕР',
      }],
    }],
  }
})

export function getArtist(artistId: string | undefined) {
  return artists.find((artist) => artist.id === artistId)
}

export function getAlbum(artist: ArtistCardData | undefined, albumId: string | undefined) {
  return artist?.albums.find((album) => album.id === albumId)
}

export function getTrack(album: AlbumData | undefined, trackId: string | undefined) {
  return album?.tracks.find((track) => track.id === trackId)
}
