import { createTheme } from '@mantine/core'

import components from './overrides'

export const theme = createTheme({
    components,
    cursorType: 'pointer',
    fontFamily:
        'Inter, system-ui, Vazirmatn, Apple Color Emoji, Noto Sans SC, Twemoji Country Flags, sans-serif',
    fontFamilyMonospace: 'Fira Mono, monospace',
    breakpoints: {
        xs: '25em',
        sm: '30em',
        md: '48em',
        lg: '64em',
        xl: '80em',
        '2xl': '96em',
        '3xl': '120em',
        '4xl': '160em'
    },
    scale: 1,
    fontSmoothing: true,
    focusRing: 'auto',
    white: '#ffffff',
    black: '#22272a',
    colors: {
        dark: [
            '#f2f2f2',
            '#c7cdd1',
            '#9da9af',
            '#67767e',
            '#394147',
            '#2e3538',
            '#252b2d',
            '#202528',
            '#171b1c',
            '#11171a'
        ],

        blue: [
            '#ddf4ff',
            '#b6e3ff',
            '#80ccff',
            '#54aeff',
            '#218bff',
            '#0969da',
            '#0550ae',
            '#033d8b',
            '#0a3069',
            '#002155'
        ],
        green: [
            '#edf8f2',
            '#d1ecde',
            '#a2d9bd',
            '#6fc49a',
            '#38ad73',
            '#00994d',
            '#008040',
            '#006b36',
            '#00542a',
            '#003d1f'
        ],
        yellow: [
            '#fff8c5',
            '#fae17d',
            '#eac54f',
            '#d4a72c',
            '#bf8700',
            '#9a6700',
            '#7d4e00',
            '#633c01',
            '#4d2d00',
            '#3b2300'
        ],
        orange: [
            '#fff1e5',
            '#ffd8b5',
            '#ffb77c',
            '#fb8f44',
            '#e16f24',
            '#bc4c00',
            '#953800',
            '#762c00',
            '#5c2200',
            '#471700'
        ]
    },
    primaryShade: { light: 6, dark: 5 },
    primaryColor: 'green',
    autoContrast: false,
    luminanceThreshold: 0.3,
    headings: {
        fontFamily: 'Inter, system-ui, Vazirmatn, Apple Color Emoji, Noto Sans SC, sans-serif',
        fontWeight: '600'
    },
    radius: { xs: '4px', sm: '6px', md: '8px', lg: '8px', xl: '12px' },
    defaultRadius: 'md'
})
