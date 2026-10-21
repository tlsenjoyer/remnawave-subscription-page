import type { CSSProperties } from 'react'

import {
    Badge,
    Button,
    Card,
    Group,
    Image,
    Input,
    Modal,
    Popover,
    Stack,
    Text,
    UnstyledButton
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconCopy, IconQrcode, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { renderSVG } from 'uqr'

import { useTranslation } from '@shared/hooks'
import { formatDate } from '@shared/utils/config-parser'
import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'

import { useSubscription } from '@entities/subscription-info-store'

import { getDashboardCopy } from '../dashboard/dashboard-copy'
import { getResetCaption, getTrafficCopy } from './traffic-copy'
import classes from './traffic-summary.module.css'
import { formatTrafficMegabytes, formatTrafficBytes, getTrafficMetrics } from './traffic.utils'

export function TrafficSummaryWidget() {
    const { user, planName, subscriptionCreatedAt } = useSubscription()
    const { t, currentLang, baseTranslations } = useTranslation()
    const [exactOpen, setExactOpen] = useState(false)
    const [qrOpen, setQrOpen] = useState(false)
    const labels = getTrafficCopy(currentLang)
    const c = getDashboardCopy(currentLang)
    const subscriptionUrl = constructSubscriptionUrl(window.location.href, user.shortUuid)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(subscriptionUrl)
            notifications.show({ message: c.copied, color: 'green' })
        } catch {
            notifications.show({ message: c.copyFailed, color: 'yellow' })
        }
    }
    const traffic = getTrafficMetrics(user)
    const status = {
        ACTIVE: { text: t(baseTranslations.active), color: 'green', icon: IconCheck },
        EXPIRED: { text: t(baseTranslations.expired), color: 'red', icon: IconX },
        LIMITED: { text: labels.limited, color: 'yellow', icon: IconAlertCircle },
        DISABLED: { text: labels.disabled, color: 'red', icon: IconX }
    }[user.userStatus]
    const StatusIcon = status.icon
    const usage = `${formatTrafficBytes(traffic.used, currentLang)} / ${traffic.unlimited ? '∞' : formatTrafficBytes(traffic.limit, currentLang)}`
    const exact = `${formatTrafficMegabytes(traffic.used, currentLang)} / ${traffic.unlimited ? '∞' : formatTrafficMegabytes(traffic.limit, currentLang)}`
    const statusBadge = (
        <Badge color={status.color} leftSection={<StatusIcon size={12} />} variant="light">
            {status.text}
        </Badge>
    )
    const expiryDate = formatDate(user.expiresAt, currentLang, baseTranslations)
    const expiry =
        expiryDate === t(baseTranslations.indefinitely)
            ? expiryDate
            : `${currentLang === 'ru' ? 'Действует до' : t(baseTranslations.expires)} ${expiryDate}`
    const summary = (
        <Card className={classes.card} data-status={user.userStatus} p={0}>
            <div className={classes.summary}>
                <Group justify="space-between" gap="sm">
                    <Text className={classes.heading}>{planName?.trim() || 'Бета тест'}</Text>
                    {statusBadge}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                    {expiry}
                </Text>
                <div className={classes.usageRow}>
                    <Stack gap={2}>
                        <Text c="dimmed" size="xs">
                            {t(baseTranslations.bandwidth)}
                        </Text>
                        {traffic.unlimited && (
                            <Text c="dimmed" size="xs">
                                {labels.unlimited}
                            </Text>
                        )}
                        {traffic.percentage !== null && traffic.percentage >= 100 && (
                            <Text c="red.3" size="xs">
                                {labels.exhausted}
                            </Text>
                        )}
                    </Stack>
                    <Popover
                        opened={exactOpen}
                        onChange={setExactOpen}
                        position="bottom-end"
                        withArrow
                    >
                        <Popover.Target>
                            <UnstyledButton
                                className={classes.amount}
                                aria-label={`${labels.exact}: ${exact}`}
                                onMouseEnter={() => setExactOpen(true)}
                                onMouseLeave={() => setExactOpen(false)}
                                onFocus={() => setExactOpen(true)}
                                onBlur={() => setExactOpen(false)}
                                onClick={() => setExactOpen(true)}
                            >
                                {usage}
                            </UnstyledButton>
                        </Popover.Target>
                        <Popover.Dropdown className={classes.popover}>
                            <Text size="xs">{labels.exact}</Text>
                            <Text size="sm" dir="ltr">
                                {exact}
                            </Text>
                        </Popover.Dropdown>
                    </Popover>
                </div>
                <div
                    className={classes.track}
                    role="progressbar"
                    aria-label={t(baseTranslations.bandwidth)}
                    aria-valuemin={0}
                    aria-valuemax={traffic.unlimited ? undefined : 100}
                    aria-valuenow={traffic.percentage === null ? undefined : traffic.progress}
                    aria-valuetext={traffic.unlimited ? `${usage} — ${labels.unlimited}` : usage}
                >
                    <div
                        className={classes.fill}
                        data-usage-color={traffic.color}
                        style={
                            {
                                width: `${traffic.progress}%`,
                                '--usage-color': `var(--mantine-color-${traffic.color}-${traffic.color === 'yellow' ? 3 : 5})`
                            } as CSSProperties
                        }
                    />
                </div>
                <Text c="dimmed" size="xs" mt="sm">
                    {getResetCaption(user.trafficLimitStrategy, currentLang, subscriptionCreatedAt)}
                </Text>
                <div className={classes.linkControls}>
                    <div className={classes.linkRow}>
                        <Input
                            className={classes.linkField}
                            classNames={{ input: classes.linkInput }}
                            aria-label={c.copy}
                            value={subscriptionUrl}
                            readOnly
                            dir="ltr"
                            onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button
                            variant="default"
                            aria-label={c.copy}
                            onClick={copy}
                            leftSection={<IconCopy size={16} />}
                        >
                            {c.copyShort}
                        </Button>
                    </div>
                    <Button
                        fullWidth
                        variant="default"
                        onClick={() => setQrOpen(true)}
                        leftSection={<IconQrcode size={17} />}
                    >
                        {c.qr}
                    </Button>
                </div>
            </div>
        </Card>
    )
    return (
        <>
            <Modal
                opened={qrOpen}
                onClose={() => setQrOpen(false)}
                title={c.qr}
                centered
                closeButtonProps={{ 'aria-label': c.close }}
            >
                <div className={classes.qr}>
                    <Image
                        alt={c.qrHint}
                        w={224}
                        h={224}
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(subscriptionUrl, { whiteColor: '#ffffff', blackColor: '#09190f', border: 3 }))}`}
                    />
                    <Text size="sm" c="dimmed">
                        {c.qrHint}
                    </Text>
                </div>
            </Modal>
            {summary}
        </>
    )
}
