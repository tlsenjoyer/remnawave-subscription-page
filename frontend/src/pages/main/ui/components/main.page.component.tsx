import {
    ActionIcon,
    Box,
    Container,
    Group,
    Image,
    Title,
    useComputedColorScheme,
    useMantineColorScheme
} from '@mantine/core'
import { TSubscriptionPagePlatformKey } from '@remnawave/subscription-page-types'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { getDashboardCopy } from '@widgets/main/dashboard/dashboard-copy'
import classes from '@widgets/main/dashboard/dashboard.module.css'
import { DashboardWidget } from '@widgets/main/dashboard/dashboard.widget'
import { TrafficSummaryWidget } from '@widgets/main/subscription-info/traffic-summary.widget'

import { Page } from '@shared/ui'
import { LanguagePicker } from '@shared/ui/language-picker/language-picker.shared'

import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'

interface IMainPageComponentProps {
    isMobile: boolean
    platform: TSubscriptionPagePlatformKey | undefined
}
export const MainPageComponent = ({ platform }: IMainPageComponentProps) => {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const colorScheme = useComputedColorScheme('light')
    const { setColorScheme } = useMantineColorScheme()
    const c = getDashboardCopy(currentLang)
    return (
        <Page>
            <Box component="header" className={classes.header}>
                <Container maw={1040} px="md">
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                            <Image
                                alt=""
                                src={
                                    config.brandingSettings.logoUrl ||
                                    'https://s.812004.xyz/static/shield-icon.svg'
                                }
                                w={26}
                                h={30}
                                fit="contain"
                            />
                            <Title order={1} size="lg" fw={600} className={classes.wordmark}>
                                {config.brandingSettings.title || 'Товарищ VPN'}
                            </Title>
                        </Group>
                        <Group gap="xs" wrap="nowrap">
                            <ActionIcon
                                size="lg"
                                variant="default"
                                aria-label={c.appearance}
                                aria-pressed={colorScheme === 'dark'}
                                onClick={() =>
                                    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
                                }
                            >
                                {colorScheme === 'dark' ? (
                                    <IconSun size={18} />
                                ) : (
                                    <IconMoon size={18} />
                                )}
                            </ActionIcon>
                            <LanguagePicker
                                currentLang={currentLang}
                                locales={config.locales}
                                onLanguageChange={setLanguage}
                            />
                        </Group>
                    </Group>
                </Container>
            </Box>
            <Container component="main" maw={1040} px="md" className={classes.main}>
                <div className={classes.dashboardGrid}>
                    <DashboardWidget platform={platform}>
                        {config.uiConfig.subscriptionInfoBlockType !== 'hidden' && (
                            <aside className={classes.subscription}>
                                <TrafficSummaryWidget />
                            </aside>
                        )}
                    </DashboardWidget>
                </div>
            </Container>
        </Page>
    )
}
