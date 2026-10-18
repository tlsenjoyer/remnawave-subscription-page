import type { CSSProperties } from 'react'

import { Badge, Card, Collapse, Group, Popover, Stack, Text, UnstyledButton } from '@mantine/core'
import {
    IconAlertCircle,
    IconCalendar,
    IconCheck,
    IconChevronDown,
    IconX
} from '@tabler/icons-react'
import { useId, useState } from 'react'

import { useTranslation } from '@shared/hooks'
import { formatDate } from '@shared/utils/config-parser'
import { vibrate } from '@shared/utils/vibrate'

import { useSubscription } from '@entities/subscription-info-store'

import { getResetCaption, getTrafficCopy } from './traffic-copy'
import classes from './traffic-summary.module.css'
import { formatExactBytes, formatTrafficBytes, getTrafficMetrics } from './traffic.utils'

export function TrafficSummaryWidget({ variant }: { variant: 'collapsed' | 'expanded' | 'cards' }) {
    const { user } = useSubscription()
    const { t, currentLang, baseTranslations } = useTranslation()
    const [expanded, setExpanded] = useState(false)
    const [exactOpen, setExactOpen] = useState(false)
    const detailsId = useId()
    const toggleId = useId()
    const labels = getTrafficCopy(currentLang)
    const traffic = getTrafficMetrics(user)
    const status = {
        ACTIVE: { text: t(baseTranslations.active), color: 'green', icon: IconCheck },
        EXPIRED: { text: t(baseTranslations.expired), color: 'red', icon: IconX },
        LIMITED: { text: labels.limited, color: 'yellow', icon: IconAlertCircle },
        DISABLED: { text: labels.disabled, color: 'red', icon: IconX }
    }[user.userStatus]
    const StatusIcon = status.icon
    const usage = `${formatTrafficBytes(traffic.used, currentLang)} / ${traffic.unlimited ? '∞' : formatTrafficBytes(traffic.limit, currentLang)}`
    const exact = `${formatExactBytes(traffic.used, currentLang)} / ${traffic.unlimited ? '∞' : formatExactBytes(traffic.limit, currentLang)}`
    const statusBadge = (
        <Badge color={status.color} leftSection={<StatusIcon size={12} />} variant="light">
            {status.text}
        </Badge>
    )
    const details = (
        <div className={classes.detailGrid}>
            <div className={classes.detail}>
                <Text c="dimmed" size="xs">
                    {t(baseTranslations.status)}
                </Text>
                <div className={classes.detailValue}>{statusBadge}</div>
            </div>
            <div className={classes.detail}>
                <Group gap={6}>
                    <IconCalendar size={14} />
                    <Text c="dimmed" size="xs">
                        {t(baseTranslations.expires)}
                    </Text>
                </Group>
                <div className={classes.detailValue}>
                    {formatDate(user.expiresAt, currentLang, baseTranslations)}
                </div>
            </div>
        </div>
    )
    const summary = (
        <Card
            className={`${classes.card} ${variant === 'cards' ? classes.trafficCard : ''}`}
            data-status={user.userStatus}
            p={0}
        >
            <div className={classes.triggerArea}>
                {variant === 'collapsed' && (
                    <UnstyledButton
                        className={classes.summaryToggle}
                        id={toggleId}
                        aria-controls={detailsId}
                        aria-expanded={expanded}
                        aria-label={expanded ? labels.hide : labels.show}
                        onClick={() => {
                            vibrate('tap')
                            setExpanded(!expanded)
                        }}
                    />
                )}
                <div className={classes.summary}>
                    <Group justify="space-between" gap="sm">
                        <Text className={classes.heading}>{t(baseTranslations.bandwidth)}</Text>
                        {statusBadge}
                    </Group>
                    <div className={classes.usageRow}>
                        <Stack gap={2}>
                            <Text c="dimmed" size="xs">
                                {getResetCaption(user.trafficLimitStrategy, currentLang)}
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
                                    aria-label={`${labels.exact}: ${usage}`}
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
                        aria-valuetext={
                            traffic.unlimited ? `${usage} — ${labels.unlimited}` : usage
                        }
                    >
                        <div
                            className={classes.fill}
                            data-usage-color={traffic.color}
                            style={
                                {
                                    width: `${traffic.progress}%`,
                                    '--usage-color': `var(--mantine-color-${traffic.color}-5)`
                                } as CSSProperties
                            }
                        />
                    </div>
                </div>
                {variant === 'collapsed' && (
                    <div className={classes.toggle} aria-hidden="true">
                        {expanded ? labels.hide : labels.show}
                        <IconChevronDown
                            className={classes.chevron}
                            size={17}
                            style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
                        />
                    </div>
                )}
            </div>
            {variant === 'collapsed' && (
                <>
                    <Collapse expanded={expanded}>
                        <div
                            className={classes.details}
                            id={detailsId}
                            role="region"
                            aria-labelledby={toggleId}
                        >
                            {details}
                        </div>
                    </Collapse>
                </>
            )}
            {variant === 'expanded' && <div className={classes.details}>{details}</div>}
        </Card>
    )
    return variant === 'cards' ? (
        <div className={classes.cards}>
            {summary}
            {details}
        </div>
    ) : (
        summary
    )
}
