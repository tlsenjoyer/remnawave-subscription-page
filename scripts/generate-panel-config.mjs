import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { BASE_TRANSLATION_LABELS, SubscriptionPageRawConfigSchema } = require('@remnawave/subscription-page-types')
const text = (en, ru = en) => ({ en, ru })
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/></svg>'
const desktop = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>'
const button = (link, en, ru, type = 'external') => ({ link, type, text: text(en, ru), svgIconKey: 'device' })
const sources = {
 incy: { download: 'https://github.com/INCY-DEV/incy-platforms', scheme: 'incy://import/{{SUBSCRIPTION_LINK}}' },
 Happ: { download: 'https://github.com/Happ-proxy/happ-desktop/releases/latest', scheme: 'happ://add/{{SUBSCRIPTION_LINK}}' },
 'Koala Clash': { download: 'https://github.com/coolcoala/koala-clash/releases/latest', scheme: 'koala-clash://install-config?url={{SUBSCRIPTION_LINK}}' },
 'Clash Meta': { download: 'https://github.com/MetaCubeX/ClashMetaForAndroid/releases/latest', scheme: 'clashmeta://install-config?url={{SUBSCRIPTION_LINK}}' },
 'Prizrak-Box': { download: 'https://docs.prizrak.app/install/', scheme: 'prizrak-box://install-config?url={{SUBSCRIPTION_LINK}}' },
 RabbitHole: { download: 'https://apps.apple.com/app/rabbithole-vpn-client/id6683309629', scheme: null },
}
const platforms = {
 ios: ['iPhone / iPad', ['incy', 'RabbitHole']], android: ['Android', ['incy', 'Happ', 'Clash Meta']],
 windows: ['Windows', ['Koala Clash', 'Happ']], macos: ['macOS', ['Koala Clash', 'Happ']],
 linux: ['Linux', ['Koala Clash', 'Happ', 'Prizrak-Box']], androidTV: ['Android TV', ['Happ']], appleTV: ['Apple TV', ['Happ']],
}
const config = {
 version: '1', locales: ['ru', 'en'],
 brandingSettings: { title: 'Товарищ VPN', logoUrl: 'https://s.812004.xyz/static/shield-icon.svg', supportUrl: 'https://t.me/tovarishvpnbot' },
 uiConfig: { subscriptionInfoBlockType: 'collapsed', installationGuidesBlockType: 'cards' },
 baseSettings: { metaTitle: 'Товарищ VPN', metaDescription: 'Ваша подписка Товарищ VPN', showConnectionKeys: false, hideGetLinkButton: false },
 baseTranslations: Object.fromEntries(Object.entries(BASE_TRANSLATION_LABELS).map(([key, label]) => [key, text(label)])),
 svgLibrary: { device: icon, desktop }, platforms: {},
}
Object.assign(config.baseTranslations, {
 bandwidth: text('LTE traffic', 'LTE трафик'), active: text('Active', 'Активна'), expired: text('Expired', 'Истекла'), inactive: text('Inactive', 'Неактивна'), status: text('Status', 'Статус'), expires: text('Expiry date', 'Дата окончания'), indefinitely: text('Indefinitely', 'Бессрочно'), unknown: text('Unknown', 'Неизвестно'),
 installationGuideHeader: text('Connection setup', 'Настройка подключения'), connectionKeysHeader: text('Connection keys', 'Ключи подключения'),
 linkCopied: text('Link copied', 'Ссылка скопирована'), linkCopiedToClipboard: text('The link has been copied to your clipboard.', 'Ссылка скопирована в буфер обмена.'),
 getLink: text('Get link', 'Получить ссылку'), copyLink: text('Copy link', 'Скопировать ссылку'), scanQrCode: text('QR code', 'QR-код'), scanQrCodeDescription: text('Scan in your VPN app.', 'Отсканируйте в VPN-приложении.'), scanToImport: text('Scan to import', 'Отсканируйте для добавления'), expiresIn: text('Expires in', 'Истекает через'), name: text('Name', 'Имя'),
})
for (const [key, [label, names]] of Object.entries(platforms)) {
 config.platforms[key] = { displayName: text(label), svgIconKey: ['ios','android'].includes(key) ? 'device' : 'desktop', apps: names.map((name, index) => {
  const source = sources[name]
  let download = source.download
  if (name === 'incy') download = key === 'ios' ? 'https://apps.apple.com/ru/app/incy/id6756943388' : 'https://play.google.com/store/apps/details?id=llc.itdev.incy'
  if (name === 'Happ' && ['android', 'androidTV'].includes(key)) download = 'https://play.google.com/store/apps/details?id=com.happproxy'
  if (name === 'Happ' && key === 'appleTV') download = 'https://apps.apple.com/us/app/happ-proxy-utility-for-tv/id6748297274'
  const installDescription = ['androidTV','appleTV'].includes(key)
   ? text('Install Happ on your TV. You can use your phone to open the download page and find the app in your TV’s store.', 'Установите Happ на телевизор. Страницу загрузки можно открыть на телефоне, а приложение найти в магазине телевизора.')
   : text('Download the app for your device, install it, and open it. On desktop, select the package for your operating system and processor. Allow the VPN permission when prompted.', 'Скачайте приложение для своего устройства, установите и откройте его. На компьютере выберите пакет для своей системы и процессора. Разрешите создание VPN-подключения, если приложение запросит доступ.')
  const downloads = [button(download, `Download ${name}`, `Скачать ${name}`)]
  if (name === 'Happ' && ['android', 'androidTV'].includes(key)) downloads.push(button('https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk', 'Download APK', 'Скачать APK'))
  if (name === 'incy' && key === 'android') downloads.push(button('https://github.com/INCY-DEV/incy-platforms/releases/download/android-v3.7.0/Incy.apk', 'Download APK', 'Скачать APK'))
  const importDescription = source.scheme
   ? text(`Click the button to open ${name} and confirm the subscription import. If the app does not open, copy the subscription link and add it inside the app.`, `Нажмите кнопку, чтобы открыть ${name}, и подтвердите добавление подписки. Если приложение не открылось, скопируйте ссылку и добавьте её в самом приложении.`)
   : text('Copy the subscription link. Open RabbitHole, add a configuration from a URL, and paste the copied link. You can also scan the QR code inside the app.', 'Скопируйте ссылку подписки. Откройте RabbitHole, добавьте конфигурацию по URL и вставьте скопированную ссылку. Также можно отсканировать QR-код в приложении.')
  return { name, featured: index === 0, svgIconKey: 'device', blocks: [
   { title: text(`Install ${name}`, `Установите ${name}`), description: installDescription, svgIconKey: 'device', svgIconColor: 'green', buttons: downloads },
   { title: text(`Add to ${name}`, `Добавьте в ${name}`), description: importDescription, svgIconKey: 'device', svgIconColor: 'green', buttons: [source.scheme ? button(source.scheme, `Add to ${name}`, `Добавить в ${name}`, 'subscriptionLink') : button('{{SUBSCRIPTION_LINK}}', 'Copy for RabbitHole', 'Скопировать для RabbitHole', 'copyButton')] },
   { title: text('Enable VPN', 'Включите VPN'), description: text(`Open ${name}, select the imported subscription and an available server, then turn on the connection. Accept the system VPN permission if prompted. If you are setting up a TV, complete these steps on the TV.`, `Откройте ${name}, выберите добавленную подписку и доступный сервер, затем включите подключение. Подтвердите системный запрос на VPN, если он появится. Если настраиваете телевизор, выполните эти действия на телевизоре.`), svgIconKey: 'device', svgIconColor: 'green', buttons: [] },
  ] }
 }) }
}
SubscriptionPageRawConfigSchema.parse(config)
await writeFile(new URL('../config/tovarish-panel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n')
console.log('Validated config/tovarish-panel.json')
