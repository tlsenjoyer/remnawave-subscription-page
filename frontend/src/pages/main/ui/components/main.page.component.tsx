import { Box, Center, Container, Group, Image, Stack, Title } from '@mantine/core'
import { TSubscriptionPagePlatformKey } from '@remnawave/subscription-page-types'
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
export const MainPageComponent = ({ isMobile, platform }: IMainPageComponentProps) => {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    return (
        <Page>
            <Box component="header" className={classes.header}>
                <Container maw={900} px="md">
                    <Group gap="sm" wrap="nowrap">
                        <Image
                            alt=""
                            src={
                                config.brandingSettings.logoUrl ||
                                'https://s.812004.xyz/static/shield-icon.svg'
                            }
                            w={34}
                            h={38}
                            fit="contain"
                        />
                        <Title order={1} size="lg" fw={700}>
                            {config.brandingSettings.title || 'Товарищ VPN'}
                        </Title>
                    </Group>
                </Container>
            </Box>
            <Container component="main" maw={900} px="md" className={classes.main}>
                <Stack gap="md">
                    {config.uiConfig.subscriptionInfoBlockType !== 'hidden' && (
                        <TrafficSummaryWidget variant="collapsed" />
                    )}
                    <DashboardWidget platform={platform} isMobile={isMobile} />
                    <Center component="footer" className={classes.footer}>
                        <LanguagePicker
                            currentLang={currentLang}
                            locales={config.locales}
                            onLanguageChange={setLanguage}
                        />
                    </Center>
                </Stack>
            </Container>
        </Page>
    )
}
