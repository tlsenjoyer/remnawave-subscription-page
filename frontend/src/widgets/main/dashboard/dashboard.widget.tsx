import type {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'

import {
    Accordion,
    Alert,
    Badge,
    Button,
    Card,
    Group,
    Image,
    Loader,
    Modal,
    Stack,
    Text,
    Title,
    UnstyledButton
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
    IconArrowLeft,
    IconArrowRight,
    IconBrandTelegram,
    IconCheck,
    IconChevronDown,
    IconChevronRight,
    IconDevices,
    IconHelpCircle,
    IconMail,
    IconShieldCheck,
    IconWifi
} from '@tabler/icons-react'
import { useRef, useState } from 'react'
import { renderSVG } from 'uqr'

import { useTranslation } from '@shared/hooks'
import { getIconFromLibrary } from '@shared/utils/config-parser'
import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { TemplateEngine } from '@shared/utils/template-engine'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

import { RawKeysWidget } from '../raw-keys/raw-keys.widget'
import { formatClientLink } from './client-link'
import { getDashboardCopy } from './dashboard-copy'
import classes from './dashboard.module.css'

const platformOrder: TSubscriptionPagePlatformKey[] = [
    'ios',
    'android',
    'windows',
    'macos',
    'linux',
    'androidTV',
    'appleTV'
]
const recommendedIndex = (apps: TSubscriptionPageAppConfig[]) =>
    Math.max(
        0,
        apps.findIndex((app) => app.featured)
    )
interface DeviceList {
    total: number
    limit: number | null
    devices: {
        platform: string | null
        osVersion: string | null
        deviceModel: string | null
        createdAt: string
        updatedAt: string
    }[]
}

export function DashboardWidget({
    platform,
    isMobile
}: {
    platform?: TSubscriptionPagePlatformKey
    isMobile: boolean
}) {
    const config = useAppConfig()
    const lang = useCurrentLang()
    const c = getDashboardCopy(lang)
    const { t } = useTranslation()
    const subscription = useSubscription()
    const available = platformOrder.filter((key) => config.platforms[key]?.apps.length)
    const [selectedPlatform, setPlatform] = useState<TSubscriptionPagePlatformKey>(
        platform && available.includes(platform) ? platform : (available[0] ?? 'android')
    )
    const [selectedIndex, setIndex] = useState(() =>
        recommendedIndex(
            config.platforms[
                platform && available.includes(platform) ? platform : (available[0] ?? 'android')
            ]?.apps ?? []
        )
    )
    const apps = config.platforms[selectedPlatform]?.apps ?? []
    const app = apps[selectedIndex] ?? apps[0]
    const [wizard, setWizard] = useState(false)
    const [step, setStep] = useState(0)
    const [alternatives, setAlternatives] = useState(false)
    const [qr, setQr] = useState(false)
    const [support, setSupport] = useState(false)
    const [devicesOpen, setDevicesOpen] = useState(false)
    const [devices, setDevices] = useState<DeviceList | null>(null)
    const [deviceError, setDeviceError] = useState<'expired' | 'unavailable' | null>(null)
    const [loading, setLoading] = useState(false)
    const deviceRequest = useRef(0)
    const connectTrigger = useRef<HTMLButtonElement>(null)
    const stepHeading = useRef<HTMLHeadingElement>(null)
    const subscriptionUrl = constructSubscriptionUrl(
        window.location.href,
        subscription.user.shortUuid
    )
    const supportEmail =
        document.getElementById('sbpg')?.dataset.supportEmail || 'support@tovarish.net'
    const move = (next: number) => {
        setStep(next)
        setQr(false)
        requestAnimationFrame(() => {
            const heading = stepHeading.current
            heading?.focus({ preventScroll: true })
            // Keep the step indicator and Back control visible after a long instruction step.
            for (
                let node = heading?.parentElement;
                node && node !== document.body;
                node = node.parentElement
            ) {
                node.scrollTop = 0
            }
        })
    }
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(subscriptionUrl)
            notifications.show({ message: c.copied, color: 'green' })
        } catch {
            notifications.show({ message: c.copyFailed, color: 'yellow' })
        }
    }
    const buttonLink = (button: TSubscriptionPageButtonConfig) =>
        button.type === 'external'
            ? button.link
            : TemplateEngine.formatWithMetaInfo(formatClientLink(button.link, subscriptionUrl), {
                  username: subscription.user.username,
                  subscriptionUrl
              })
    const buttons = (items: TSubscriptionPageButtonConfig[]) =>
        items.map((button, index) => {
            const link = buttonLink(button)
            if (button.type === 'copyButton')
                return (
                    <Button
                        key={index}
                        variant="light"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(link)
                                notifications.show({ message: c.copied })
                            } catch {
                                notifications.show({ message: c.copyFailed, color: 'yellow' })
                            }
                        }}
                    >
                        {t(button.text)}
                    </Button>
                )
            return (
                <Button
                    component="a"
                    href={link}
                    key={index}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="filled"
                    size="md"
                >
                    {t(button.text)}
                </Button>
            )
        })
    const blocks = (start: number, end?: number) =>
        app?.blocks.slice(start, end).map((block, index) => (
            <section className={classes.instruction} key={index}>
                <Title order={3} size="lg">
                    <span dangerouslySetInnerHTML={{ __html: t(block.title) }} />
                </Title>
                <div
                    className={classes.instructionText}
                    dangerouslySetInnerHTML={{ __html: t(block.description) }}
                />
                <Stack gap="sm">{buttons(block.buttons)}</Stack>
            </section>
        ))
    const contactButtons = (
        <Stack gap="sm">
            <Button
                component="a"
                href={`mailto:${supportEmail}`}
                variant="light"
                leftSection={<IconMail size={18} />}
            >
                {supportEmail}
            </Button>
            <Button
                component="a"
                href={config.brandingSettings.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconBrandTelegram size={18} />}
            >
                {c.telegram}
            </Button>
        </Stack>
    )
    const supportSection = (
        <section className={classes.supportInset}>
            <Title order={3} size="lg">
                {c.help}
            </Title>
            <Text c="dimmed" size="sm" mb="md">
                {c.helpText}
            </Text>
            {contactButtons}
        </section>
    )
    const loadDevices = async () => {
        const id = ++deviceRequest.current
        setLoading(true)
        setDeviceError(null)
        setDevices(null)
        try {
            const base = new URL(subscriptionUrl)
            base.pathname = base.pathname.replace(/\/[^/]+\/?$/, '/api/devices')
            const response = await fetch(base, {
                credentials: 'same-origin',
                headers: { 'X-Subscription-Id': subscription.user.shortUuid },
                cache: 'no-store',
                signal: AbortSignal.timeout(15000)
            })
            if (id !== deviceRequest.current) return
            if (!response.ok) {
                setDeviceError(response.status === 401 ? 'expired' : 'unavailable')
                return
            }
            const data: DeviceList = await response.json()
            if (id === deviceRequest.current) setDevices(data)
        } catch {
            if (id === deviceRequest.current) setDeviceError('unavailable')
        } finally {
            if (id === deviceRequest.current) setLoading(false)
        }
    }
    const date = (value: string) =>
        new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(value))
    return (
        <>
            <Card className={classes.connection} p={0}>
                <div className={classes.connectionTop}>
                    <div className={classes.connectionIcon}>
                        <IconWifi size={26} />
                    </div>
                    <div>
                        <Text className={classes.eyebrow}>{config.brandingSettings.title}</Text>
                        <Title order={2} className={classes.connectionTitle}>
                            {c.intro}
                        </Title>
                    </div>
                </div>
                <Text c="dimmed" className={classes.subtitle}>
                    {c.subtitle}
                </Text>
                <Button
                    ref={connectTrigger}
                    variant="filled"
                    className={classes.connectButton}
                    size="xl"
                    fullWidth
                    rightSection={<IconArrowRight size={21} />}
                    onClick={() => {
                        setStep(0)
                        setQr(false)
                        setAlternatives(false)
                        setWizard(true)
                    }}
                >
                    {c.connect}
                </Button>
            </Card>
            <UnstyledButton
                className={classes.deviceRow}
                onClick={() => {
                    setDevicesOpen(true)
                    void loadDevices()
                }}
            >
                <span className={classes.rowLabel}>
                    <IconDevices size={22} />
                    {c.devices}
                </span>
                <span className={classes.rowEnd}>
                    {devices &&
                        `${devices.total}${devices.limit && devices.limit > 0 ? ` / ${devices.limit}` : ''}`}
                    <IconChevronRight size={20} />
                </span>
            </UnstyledButton>
            <section className={classes.supportCard}>
                <IconHelpCircle size={24} />
                <div>
                    <Title order={2} size="md">
                        {c.helpMain}
                    </Title>
                    <Button
                        variant="subtle"
                        px={0}
                        onClick={() => setSupport(true)}
                        rightSection={<IconArrowRight size={16} />}
                    >
                        {c.support}
                    </Button>
                </div>
            </section>

            <Modal
                onExitTransitionEnd={() => connectTrigger.current?.focus()}
                closeOnEscape={!support}
                trapFocus={!support}
                opened={wizard}
                onClose={() => setWizard(false)}
                fullScreen
                title={c.step}
                closeButtonProps={{ 'aria-label': c.close }}
                classNames={{
                    content: classes.wizard,
                    header: classes.wizardHeader,
                    body: classes.wizardBody
                }}
            >
                <div className={classes.wizardShell}>
                    <div className={classes.wizardToolbar}>
                        {step > 0 ? (
                            <Button
                                variant="subtle"
                                leftSection={<IconArrowLeft size={17} />}
                                onClick={() => move(step - 1)}
                            >
                                {c.back}
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button
                            variant="subtle"
                            leftSection={<IconHelpCircle size={17} />}
                            onClick={() => setSupport(true)}
                        >
                            {c.support}
                        </Button>
                    </div>
                    <ol className={classes.steps} aria-label={c.step}>
                        {[c.install, c.import, c.complete].map((label, index) => (
                            <li
                                key={label}
                                data-active={step >= index}
                                aria-current={step === index ? 'step' : undefined}
                            >
                                <span>
                                    {index < step ? <IconCheck size={14} /> : `0${index + 1}`}
                                </span>
                                {label}
                            </li>
                        ))}
                    </ol>
                    {subscription.user.userStatus !== 'ACTIVE' && (
                        <Alert color="yellow" mb="lg">
                            {c.warning}
                        </Alert>
                    )}
                    {step === 0 && (
                        <>
                            <Title
                                ref={stepHeading}
                                tabIndex={-1}
                                order={2}
                                className={classes.stepTitle}
                            >
                                {c.platform}
                            </Title>
                            <div className={classes.platforms} role="group" aria-label={c.platform}>
                                {available.map((key) => (
                                    <UnstyledButton
                                        aria-pressed={key === selectedPlatform}
                                        className={classes.platform}
                                        key={key}
                                        onClick={() => {
                                            setPlatform(key)
                                            setIndex(recommendedIndex(config.platforms[key]!.apps))
                                            setAlternatives(false)
                                            move(0)
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    getIconFromLibrary(
                                                        config.platforms[key]!.svgIconKey,
                                                        config.svgLibrary
                                                    ) || ''
                                            }}
                                        />
                                        {t(config.platforms[key]!.displayName)}
                                    </UnstyledButton>
                                ))}
                            </div>
                            {app ? (
                                <>
                                    <div className={classes.selectedApp}>
                                        <div>
                                            <Text size="xs" c="dimmed">
                                                {c.app}
                                            </Text>
                                            <Title order={2}>{app.name}</Title>
                                        </div>
                                        {selectedIndex === recommendedIndex(apps) && (
                                            <Badge variant="light">{c.recommended}</Badge>
                                        )}
                                    </div>
                                    {apps.length > 1 && (
                                        <>
                                            <Button
                                                variant="subtle"
                                                size="sm"
                                                className={classes.alternativeToggle}
                                                rightSection={<IconChevronDown size={15} />}
                                                aria-expanded={alternatives}
                                                onClick={() => setAlternatives(!alternatives)}
                                            >
                                                {c.choose}
                                            </Button>
                                            {alternatives && (
                                                <div
                                                    className={classes.alternatives}
                                                    role="group"
                                                    aria-label={c.choose}
                                                >
                                                    {apps.map((item, index) => (
                                                        <Button
                                                            variant={
                                                                index === selectedIndex
                                                                    ? 'filled'
                                                                    : 'light'
                                                            }
                                                            aria-pressed={index === selectedIndex}
                                                            key={item.name}
                                                            onClick={() => {
                                                                setIndex(index)
                                                                setAlternatives(false)
                                                                move(0)
                                                            }}
                                                        >
                                                            {item.name}
                                                            {index === recommendedIndex(apps)
                                                                ? ` · ${c.recommended}`
                                                                : ''}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <Text c="dimmed" size="sm" mb="lg">
                                        {c.preparing}
                                    </Text>
                                    {blocks(0, 1)}
                                    {app.blocks.length > 0 ? (
                                        <Button
                                            size="lg"
                                            fullWidth
                                            mt="xl"
                                            variant="light"
                                            onClick={() => move(1)}
                                            rightSection={<IconArrowRight size={18} />}
                                        >
                                            {c.installed}
                                        </Button>
                                    ) : (
                                        <Alert color="yellow">{c.unavailable}</Alert>
                                    )}
                                </>
                            ) : (
                                <Alert color="yellow">
                                    {c.unavailable}
                                    <Button onClick={() => setSupport(true)}>{c.support}</Button>
                                </Alert>
                            )}
                        </>
                    )}
                    {step === 1 && (
                        <>
                            <Title
                                ref={stepHeading}
                                tabIndex={-1}
                                order={2}
                                className={classes.stepTitle}
                            >
                                {c.add}
                            </Title>
                            <Text c="dimmed" mb="xl">
                                {c.addText}
                            </Text>
                            {blocks(1)}
                            <Stack gap="sm" mt="lg">
                                <Button variant="light" size="md" onClick={copy}>
                                    {c.copy}
                                </Button>
                                <Button
                                    variant="default"
                                    size="md"
                                    onClick={() => setQr(!qr)}
                                    aria-expanded={qr}
                                >
                                    {c.qr}
                                </Button>
                            </Stack>
                            {qr && (
                                <div className={classes.qr}>
                                    <Image
                                        alt={c.qrHint}
                                        w={200}
                                        h={200}
                                        src={`data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(subscriptionUrl, { whiteColor: '#ffffff', blackColor: '#09190f', border: 3 }))}`}
                                    />
                                    <Text size="sm" c="dimmed">
                                        {c.qrHint}
                                    </Text>
                                </div>
                            )}
                            <Accordion mt="md" variant="separated">
                                <Accordion.Item value="advanced">
                                    <Accordion.Control>{c.advanced}</Accordion.Control>
                                    <Accordion.Panel>
                                        <Text component="code" className={classes.rawLink}>
                                            {subscriptionUrl}
                                        </Text>
                                        <Text c="dimmed" size="xs" my="md">
                                            {c.privateLink}
                                        </Text>
                                        <RawKeysWidget isMobile={isMobile} />
                                    </Accordion.Panel>
                                </Accordion.Item>
                            </Accordion>
                            <Button
                                variant="filled"
                                size="lg"
                                fullWidth
                                mt="xl"
                                onClick={() => move(2)}
                                rightSection={<IconArrowRight size={18} />}
                            >
                                {c.finish}
                            </Button>
                        </>
                    )}
                    {step === 2 && (
                        <div className={classes.completion}>
                            <div className={classes.successMark}>
                                <IconShieldCheck size={68} stroke={1.4} />
                            </div>
                            <Title ref={stepHeading} tabIndex={-1} order={2}>
                                {c.success}
                            </Title>
                            <Text c="dimmed" mt="sm" mb="xl">
                                {c.successText}
                            </Text>
                            <Button
                                variant="filled"
                                size="lg"
                                fullWidth
                                onClick={() => setWizard(false)}
                            >
                                {c.close}
                            </Button>
                            {supportSection}
                        </div>
                    )}
                </div>
            </Modal>
            <Modal
                closeOnEscape={!support}
                trapFocus={!support}
                opened={devicesOpen}
                onClose={() => {
                    setDevicesOpen(false)
                    deviceRequest.current++
                }}
                title={c.devices}
                centered
                size="lg"
                closeButtonProps={{ 'aria-label': c.close }}
            >
                <Stack gap="lg">
                    <Text c="dimmed" size="sm">
                        {c.deviceHint}
                    </Text>
                    {loading && (
                        <Group role="status">
                            <Loader size="sm" />
                            <Text>{c.loading}</Text>
                        </Group>
                    )}
                    {deviceError && (
                        <Alert color="yellow">
                            <Text>
                                {deviceError === 'expired' ? c.sessionExpired : c.deviceError}
                            </Text>
                            <Button
                                mt="sm"
                                variant="light"
                                onClick={() =>
                                    deviceError === 'expired'
                                        ? window.location.reload()
                                        : void loadDevices()
                                }
                            >
                                {deviceError === 'expired' ? c.reload : c.retry}
                            </Button>
                        </Alert>
                    )}
                    {devices && (
                        <>
                            <Card p="md">
                                <Text c="dimmed" size="xs">
                                    {c.registered}
                                </Text>
                                <Title order={2}>
                                    {devices.total}
                                    {devices.limit !== null && devices.limit > 0
                                        ? ` / ${devices.limit}`
                                        : ''}
                                </Title>
                                <Text size="xs" c="dimmed">
                                    {devices.limit !== null && devices.limit > 0
                                        ? c.allowance
                                        : c.noLimit}
                                </Text>
                            </Card>
                            {devices.devices.length === 0 ? (
                                <Text>{c.empty}</Text>
                            ) : (
                                devices.devices.map((device, index) => (
                                    <Card p="md" key={index}>
                                        <Group wrap="nowrap">
                                            <IconDevices size={24} />
                                            <div>
                                                <Text fw={600}>
                                                    {device.deviceModel ||
                                                        device.platform ||
                                                        c.unknownDevice}
                                                </Text>
                                                <Text c="dimmed" size="sm">
                                                    {[device.platform, device.osVersion]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </Text>
                                                <Text c="dimmed" size="xs" mt="xs">
                                                    {c.registeredAt}: {date(device.createdAt)}
                                                    <br />
                                                    {c.updatedAt}: {date(device.updatedAt)}
                                                </Text>
                                            </div>
                                        </Group>
                                    </Card>
                                ))
                            )}
                            <Button variant="light" onClick={() => void loadDevices()}>
                                {c.retry}
                            </Button>
                        </>
                    )}
                    <Button variant="subtle" onClick={() => setSupport(true)}>
                        {c.support}
                    </Button>
                </Stack>
            </Modal>
            <Modal
                opened={support}
                onClose={() => setSupport(false)}
                title={c.support}
                centered
                closeButtonProps={{ 'aria-label': c.close }}
            >
                <Text c="dimmed" size="sm" mb="lg">
                    {c.helpText}
                </Text>
                {contactButtons}
            </Modal>
        </>
    )
}
