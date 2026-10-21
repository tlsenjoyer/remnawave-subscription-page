import type {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import type { ReactNode } from 'react'

import {
    Alert,
    Badge,
    Button,
    Card,
    Group,
    Loader,
    Menu,
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
    IconWifi
} from '@tabler/icons-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { FaAndroid, FaApple, FaLinux, FaWindows } from 'react-icons/fa6'

import { useTranslation } from '@shared/hooks'
import { getIconFromLibrary } from '@shared/utils/config-parser'
import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { TemplateEngine } from '@shared/utils/template-engine'

import { useAppConfig, useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

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
const platformIcons = {
    ios: FaApple,
    android: FaAndroid,
    windows: FaWindows,
    macos: FaApple,
    linux: FaLinux,
    androidTV: FaAndroid,
    appleTV: FaApple
} satisfies Record<TSubscriptionPagePlatformKey, typeof FaApple>

const recommendedIndex = (apps: TSubscriptionPageAppConfig[]) =>
    Math.max(
        0,
        apps.findIndex((app) => app.featured)
    )
interface DeviceList {
    total: number
    limit: number | null
    devices: {
        id: string
        platform: string | null
        osVersion: string | null
        deviceModel: string | null
        createdAt: string
        updatedAt: string
    }[]
}

export function DashboardWidget({
    platform,
    children
}: {
    platform?: TSubscriptionPagePlatformKey
    children?: ReactNode
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
    const [support, setSupport] = useState(false)
    const [devicesOpen, setDevicesOpen] = useState(false)
    const [devices, setDevices] = useState<DeviceList | null>(null)
    const [deviceError, setDeviceError] = useState<'expired' | 'unavailable' | 'delete' | null>(
        null
    )
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const deviceRequest = useRef(0)
    const refreshDevices = useRef<HTMLButtonElement>(null)
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
        requestAnimationFrame(() => {
            const heading = stepHeading.current
            heading?.focus({ preventScroll: true })
            // Return to the shared frame after a long instruction step.
            for (
                let node = heading?.parentElement;
                node && node !== document.body;
                node = node.parentElement
            ) {
                node.scrollTop = 0
            }
        })
    }
    const buttonLink = (button: TSubscriptionPageButtonConfig) =>
        button.type === 'external'
            ? button.link
            : TemplateEngine.formatWithMetaInfo(formatClientLink(button.link, subscriptionUrl), {
                  username: subscription.user.username,
                  subscriptionUrl
              })
    const copyLink = async (link: string) => {
        try {
            await navigator.clipboard.writeText(link)
            notifications.show({ message: c.copied })
        } catch {
            notifications.show({ message: c.copyFailed, color: 'yellow' })
        }
    }
    const buttons = (items: TSubscriptionPageButtonConfig[]) =>
        items.map((button, index) => {
            const link = buttonLink(button)
            const svg = getIconFromLibrary(button.svgIconKey, config.svgLibrary)
            const icon = svg ? (
                <span
                    className={classes.panelIcon}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            ) : undefined
            if (button.type === 'copyButton')
                return (
                    <Button
                        key={index}
                        leftSection={icon}
                        variant="light"
                        onClick={() => void copyLink(link)}
                    >
                        {t(button.text)}
                    </Button>
                )
            return (
                <Button
                    component="a"
                    leftSection={icon}
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
                {block.buttons.length > 0 && <Stack gap="sm">{buttons(block.buttons)}</Stack>}
            </section>
        ))
    const contactButtons = (
        <Stack gap="sm">
            <Button
                component="a"
                href={config.brandingSettings.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconBrandTelegram size={18} />}
            >
                {c.telegram}
            </Button>
            <Button
                component="a"
                href={`mailto:${supportEmail}`}
                variant="light"
                leftSection={<IconMail size={18} />}
            >
                {supportEmail}
            </Button>
        </Stack>
    )
    const loadDevices = async (deviceId?: string) => {
        const id = ++deviceRequest.current
        if (deviceId === undefined) setLoading(true)
        else setDeleting(deviceId)
        try {
            const base = new URL(subscriptionUrl)
            base.pathname = base.pathname.replace(/\/[^/]+\/?$/, '/api/devices')
            const response = await fetch(base, {
                credentials: 'same-origin',
                method: deviceId === undefined ? 'GET' : 'DELETE',
                headers: {
                    'X-Subscription-Id': subscription.user.shortUuid,
                    ...(deviceId === undefined ? {} : { 'Content-Type': 'application/json' })
                },
                body: deviceId === undefined ? undefined : JSON.stringify({ id: deviceId }),
                cache: 'no-store',
                signal: AbortSignal.timeout(15000)
            })
            if (id !== deviceRequest.current) return
            if (!response.ok) {
                if (deviceId === undefined) setDevices(null)
                setDeviceError(
                    response.status === 401
                        ? 'expired'
                        : deviceId === undefined
                          ? 'unavailable'
                          : 'delete'
                )
                return
            }
            const data: DeviceList = await response.json()
            if (id === deviceRequest.current) {
                setDevices(data)
                setDeviceError(null)
                if (deviceId !== undefined) {
                    // Enable the focus target before restoring keyboard focus.
                    flushSync(() => setDeleting(null))
                    refreshDevices.current?.focus({ preventScroll: true })
                }
            }
        } catch {
            if (id === deviceRequest.current) {
                if (deviceId === undefined) setDevices(null)
                setDeviceError(deviceId === undefined ? 'unavailable' : 'delete')
            }
        } finally {
            if (id === deviceRequest.current) setLoading(false)
            if (deviceId !== undefined) setDeleting(null)
        }
    }
    const date = (value: string) =>
        new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(value))
    return (
        <>
            <Card className={classes.connection} p={0}>
                <div className={classes.connectionTop}>
                    <Text className={classes.eyebrow}>{c.step}</Text>
                    <IconWifi size={21} aria-hidden="true" />
                </div>
                <Title order={2} className={classes.connectionTitle}>
                    {c.intro}
                </Title>
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
                        setAlternatives(false)
                        setWizard(true)
                    }}
                >
                    {c.connect}
                </Button>
            </Card>
            {children}
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
                        px="sm"
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
                withCloseButton={false}
                classNames={{
                    content: classes.wizard,
                    header: classes.wizardHeader,
                    body: classes.wizardBody
                }}
            >
                <div className={classes.wizardContent}>
                    <div className={classes.wizardShell}>
                        <Modal.Header>
                            <Modal.Title>{c.step}</Modal.Title>
                            <Modal.CloseButton aria-label={c.close} size={40} iconSize={20} />
                        </Modal.Header>
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
                        <section className={classes.stepPanel}>
                            <div key={step} className={classes.stepContent}>
                                <div className={classes.stepHeading}>
                                    {step === 2 && (
                                        <span className={classes.successMark}>
                                            <IconCheck size={22} stroke={1.8} aria-hidden="true" />
                                        </span>
                                    )}
                                    <Title
                                        ref={stepHeading}
                                        tabIndex={-1}
                                        order={2}
                                        className={classes.stepTitle}
                                    >
                                        {step === 0
                                            ? c.installTitle
                                            : step === 1
                                              ? c.add
                                              : c.success}
                                    </Title>
                                </div>
                                {step === 0 && (
                                    <>
                                        <Text size="sm" c="dimmed" mb="sm">
                                            {c.platform}
                                        </Text>
                                        <div
                                            className={classes.platforms}
                                            role="group"
                                            aria-label={c.platform}
                                        >
                                            {available.map((key) => (
                                                <UnstyledButton
                                                    aria-pressed={key === selectedPlatform}
                                                    className={classes.platform}
                                                    key={key}
                                                    onClick={() => {
                                                        setPlatform(key)
                                                        setIndex(
                                                            recommendedIndex(
                                                                config.platforms[key]!.apps
                                                            )
                                                        )
                                                        setAlternatives(false)
                                                        move(0)
                                                    }}
                                                >
                                                    <span aria-hidden="true">
                                                        {(() => {
                                                            const PlatformIcon = platformIcons[key]
                                                            return <PlatformIcon size={20} />
                                                        })()}
                                                    </span>
                                                    {t(config.platforms[key]!.displayName)}
                                                </UnstyledButton>
                                            ))}
                                        </div>
                                        {app ? (
                                            <div className={classes.appSection}>
                                                <div className={classes.selectedApp}>
                                                    <Title order={3}>{app.name}</Title>
                                                    {selectedIndex === recommendedIndex(apps) && (
                                                        <Badge variant="light">
                                                            {c.recommended}
                                                        </Badge>
                                                    )}
                                                    {apps.length > 1 && (
                                                        <Menu
                                                            classNames={{
                                                                item: classes.clientOption
                                                            }}
                                                            opened={alternatives}
                                                            onChange={setAlternatives}
                                                            position="bottom-end"
                                                            transitionProps={{
                                                                transition: 'pop',
                                                                duration: 140
                                                            }}
                                                        >
                                                            <Menu.Target>
                                                                <Button
                                                                    variant="default"
                                                                    size="xs"
                                                                    aria-label={c.choose}
                                                                    rightSection={
                                                                        <IconChevronDown
                                                                            size={15}
                                                                        />
                                                                    }
                                                                >
                                                                    {c.change}
                                                                </Button>
                                                            </Menu.Target>
                                                            <Menu.Dropdown aria-label={c.choose}>
                                                                {apps.map((item, index) => (
                                                                    <Menu.Item
                                                                        key={item.name}
                                                                        leftSection={
                                                                            index ===
                                                                            selectedIndex ? (
                                                                                <IconCheck
                                                                                    size={16}
                                                                                />
                                                                            ) : undefined
                                                                        }
                                                                        onClick={() =>
                                                                            setIndex(index)
                                                                        }
                                                                    >
                                                                        {item.name}
                                                                    </Menu.Item>
                                                                ))}
                                                            </Menu.Dropdown>
                                                        </Menu>
                                                    )}
                                                </div>
                                                {blocks(0, 1)}
                                                {app.blocks.length === 0 && (
                                                    <Alert color="yellow">{c.unavailable}</Alert>
                                                )}
                                            </div>
                                        ) : (
                                            <Alert color="yellow">{c.unavailable}</Alert>
                                        )}
                                    </>
                                )}
                                {step === 1 && (
                                    <>
                                        <Text c="dimmed" size="sm" className={classes.chosenApp}>
                                            {t(config.platforms[selectedPlatform]!.displayName)} ·{' '}
                                            {app?.name}
                                        </Text>
                                        {blocks(1)}
                                    </>
                                )}
                                {step === 2 && (
                                    <Text c="dimmed">
                                        {c.successText.replace('{app}', app?.name ?? c.app)}
                                    </Text>
                                )}
                            </div>
                        </section>
                        <nav className={classes.wizardNavigation} aria-label={c.step}>
                            <Button
                                variant="default"
                                disabled={step === 0}
                                leftSection={<IconArrowLeft size={17} />}
                                onClick={() => move(step - 1)}
                            >
                                {c.back}
                            </Button>
                            <Button
                                className={classes.continueButton}
                                variant="default"
                                disabled={step === 0 && !app?.blocks.length}
                                rightSection={step < 2 ? <IconArrowRight size={18} /> : undefined}
                                onClick={() => (step === 2 ? setWizard(false) : move(step + 1))}
                            >
                                {step === 2 ? c.returnToSubscription : c.finish}
                            </Button>
                        </nav>
                    </div>
                </div>
                <footer className={classes.wizardFooter}>
                    <Text size="sm" c="dimmed">
                        {c.helpMain}
                    </Text>
                    <Button variant="subtle" size="sm" onClick={() => setSupport(true)}>
                        {c.support}
                    </Button>
                </footer>
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
                <Stack gap="lg" aria-busy={loading || deleting !== null}>
                    <Text c="dimmed" size="sm">
                        {c.deviceHint}
                    </Text>
                    {loading && !devices && !deviceError && (
                        <Group role="status">
                            <Loader size="sm" />
                            <Text>{c.loading}</Text>
                        </Group>
                    )}
                    {deviceError && (
                        <Alert color="yellow">
                            <Text>
                                {deviceError === 'expired'
                                    ? c.sessionExpired
                                    : deviceError === 'delete'
                                      ? c.deleteDeviceError
                                      : c.deviceError}
                            </Text>
                            <Button
                                mt="sm"
                                variant="light"
                                loading={loading}
                                disabled={deleting !== null}
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
                                devices.devices.map((device) => (
                                    <Card p="md" key={device.id}>
                                        <Group wrap="nowrap">
                                            <IconDevices size={24} style={{ flexShrink: 0 }} />
                                            <div className={classes.deviceDetails}>
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
                                            <UnstyledButton
                                                className={classes.deleteDevice}
                                                disabled={
                                                    loading ||
                                                    deleting !== null ||
                                                    deviceError === 'expired'
                                                }
                                                aria-busy={deleting === device.id}
                                                onClick={() => void loadDevices(device.id)}
                                            >
                                                {deleting === device.id
                                                    ? c.deletingDevice
                                                    : c.deleteDevice}
                                            </UnstyledButton>
                                        </Group>
                                    </Card>
                                ))
                            )}
                            <Button
                                ref={refreshDevices}
                                variant="light"
                                loading={loading}
                                disabled={deleting !== null}
                                onClick={() => void loadDevices()}
                            >
                                {c.retry}
                            </Button>
                        </>
                    )}
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
