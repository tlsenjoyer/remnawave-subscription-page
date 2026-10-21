const en = {
    show: 'Show details',
    hide: 'Hide details',
    unlimited: 'Unlimited traffic',
    daily: 'Resets daily',
    weekly: 'Resets weekly',
    monthly: 'Resets monthly',
    noReset: 'No automatic reset',
    limited: 'Limited',
    disabled: 'Disabled',
    exact: 'Exact usage (MB)',
    exhausted: 'Traffic limit reached'
}
type Copy = typeof en
const copy: Record<string, Copy> = {
    en,
    ru: {
        show: 'Подробнее',
        hide: 'Скрыть подробности',
        unlimited: 'Безлимитный трафик',
        daily: 'Сброс ежедневно',
        weekly: 'Сброс еженедельно',
        monthly: 'Сброс ежемесячно',
        noReset: 'Без автоматического сброса',
        limited: 'Ограничена',
        disabled: 'Отключена',
        exact: 'Точный расход (МБ)',
        exhausted: 'Лимит трафика исчерпан'
    },
    fa: {
        show: 'نمایش جزئیات',
        hide: 'پنهان کردن جزئیات',
        unlimited: 'ترافیک نامحدود',
        daily: 'بازنشانی روزانه',
        weekly: 'بازنشانی هفتگی',
        monthly: 'بازنشانی ماهانه',
        noReset: 'بدون بازنشانی خودکار',
        limited: 'محدود شده',
        disabled: 'غیرفعال',
        exact: 'مصرف دقیق (MB)',
        exhausted: 'سقف ترافیک مصرف شده است'
    },
    zh: {
        show: '查看详情',
        hide: '收起详情',
        unlimited: '无限流量',
        daily: '每日重置',
        weekly: '每周重置',
        monthly: '每月重置',
        noReset: '不自动重置',
        limited: '已限制',
        disabled: '已禁用',
        exact: '精确用量（MB）',
        exhausted: '流量已用尽'
    },
    fr: {
        show: 'Voir les détails',
        hide: 'Masquer les détails',
        unlimited: 'Trafic illimité',
        daily: 'Réinitialisation quotidienne',
        weekly: 'Réinitialisation hebdomadaire',
        monthly: 'Réinitialisation mensuelle',
        noReset: 'Sans réinitialisation automatique',
        limited: 'Limité',
        disabled: 'Désactivé',
        exact: 'Utilisation exacte (Mo)',
        exhausted: 'Limite de trafic atteinte'
    }
}
// New UI copy stays local: no fields are added to the panel's configuration schema.
const extra: Record<string, string[]> = {
    uz: [
        'Батафсил',
        'Тафсилотларни яшириш',
        'Чексиз трафик',
        'Ҳар куни янгиланади',
        'Ҳар ҳафта янгиланади',
        'Ҳар ой янгиланади',
        'Автоматик янгиланмайди',
        'Чекланган',
        'Ўчирилган',
        'Аниқ сарф (МБ)',
        'Трафик лимити тугаган'
    ],
    de: [
        'Details anzeigen',
        'Details ausblenden',
        'Unbegrenztes Datenvolumen',
        'Tägliche Zurücksetzung',
        'Wöchentliche Zurücksetzung',
        'Monatliche Zurücksetzung',
        'Keine automatische Zurücksetzung',
        'Begrenzt',
        'Deaktiviert',
        'Exakte Nutzung (MB)',
        'Datenlimit erreicht'
    ],
    hi: [
        'विवरण दिखाएँ',
        'विवरण छिपाएँ',
        'असीमित ट्रैफ़िक',
        'प्रतिदिन रीसेट',
        'प्रति सप्ताह रीसेट',
        'प्रति माह रीसेट',
        'स्वचालित रीसेट नहीं',
        'सीमित',
        'अक्षम',
        'सटीक उपयोग (MB)',
        'ट्रैफ़िक सीमा पूरी हुई'
    ],
    tr: [
        'Ayrıntıları göster',
        'Ayrıntıları gizle',
        'Sınırsız trafik',
        'Günlük sıfırlanır',
        'Haftalık sıfırlanır',
        'Aylık sıfırlanır',
        'Otomatik sıfırlanmaz',
        'Sınırlı',
        'Devre dışı',
        'Tam kullanım (MB)',
        'Trafik sınırına ulaşıldı'
    ],
    az: [
        'Ətraflı göstər',
        'Təfərrüatları gizlət',
        'Limitsiz trafik',
        'Hər gün sıfırlanır',
        'Hər həftə sıfırlanır',
        'Hər ay sıfırlanır',
        'Avtomatik sıfırlanmır',
        'Məhdudlaşdırılıb',
        'Deaktivdir',
        'Dəqiq istifadə (MB)',
        'Trafik limiti bitib'
    ],
    es: [
        'Ver detalles',
        'Ocultar detalles',
        'Tráfico ilimitado',
        'Se restablece diariamente',
        'Se restablece semanalmente',
        'Se restablece mensualmente',
        'Sin restablecimiento automático',
        'Limitada',
        'Desactivada',
        'Uso exacto (MB)',
        'Límite de tráfico alcanzado'
    ],
    vi: [
        'Xem chi tiết',
        'Ẩn chi tiết',
        'Lưu lượng không giới hạn',
        'Đặt lại hằng ngày',
        'Đặt lại hằng tuần',
        'Đặt lại hằng tháng',
        'Không tự động đặt lại',
        'Bị giới hạn',
        'Đã tắt',
        'Mức sử dụng chính xác (MB)',
        'Đã hết lưu lượng'
    ],
    ja: [
        '詳細を表示',
        '詳細を閉じる',
        '無制限の通信量',
        '毎日リセット',
        '毎週リセット',
        '毎月リセット',
        '自動リセットなし',
        '制限中',
        '無効',
        '正確な使用量（MB）',
        '通信量の上限に達しました'
    ],
    be: [
        'Падрабязней',
        'Схаваць падрабязнасці',
        'Неабмежаваны трафік',
        'Скід штодня',
        'Скід штотыдзень',
        'Скід штомесяц',
        'Без аўтаматычнага скіду',
        'Абмежавана',
        'Адключана',
        'Дакладны расход (МБ)',
        'Ліміт трафіку вычарпаны'
    ],
    uk: [
        'Докладніше',
        'Приховати подробиці',
        'Безлімітний трафік',
        'Скидання щодня',
        'Скидання щотижня',
        'Скидання щомісяця',
        'Без автоматичного скидання',
        'Обмежена',
        'Вимкнена',
        'Точне використання (МБ)',
        'Ліміт трафіку вичерпано'
    ],
    pt: [
        'Mostrar detalhes',
        'Ocultar detalhes',
        'Tráfego ilimitado',
        'Reinicia diariamente',
        'Reinicia semanalmente',
        'Reinicia mensalmente',
        'Sem reinício automático',
        'Limitada',
        'Desativada',
        'Uso exato (MB)',
        'Limite de tráfego atingido'
    ],
    pl: [
        'Pokaż szczegóły',
        'Ukryj szczegóły',
        'Nielimitowany transfer',
        'Reset codziennie',
        'Reset co tydzień',
        'Reset co miesiąc',
        'Bez automatycznego resetu',
        'Ograniczona',
        'Wyłączona',
        'Dokładne użycie (MB)',
        'Limit transferu wykorzystany'
    ],
    id: [
        'Lihat detail',
        'Sembunyikan detail',
        'Trafik tanpa batas',
        'Direset setiap hari',
        'Direset setiap minggu',
        'Direset setiap bulan',
        'Tanpa reset otomatis',
        'Dibatasi',
        'Dinonaktifkan',
        'Penggunaan tepat (MB)',
        'Batas trafik tercapai'
    ],
    tk: [
        'Jikme-jik görkez',
        'Jikme-jiklikleri gizle',
        'Çäksiz trafik',
        'Her gün täzelenýär',
        'Her hepde täzelenýär',
        'Her aý täzelenýär',
        'Awtomatiki täzelenme ýok',
        'Çäklendirilen',
        'Öçürilen',
        'Takyk ulanyş (MB)',
        'Trafik çägine ýetildi'
    ],
    th: [
        'แสดงรายละเอียด',
        'ซ่อนรายละเอียด',
        'ปริมาณข้อมูลไม่จำกัด',
        'รีเซ็ตทุกวัน',
        'รีเซ็ตทุกสัปดาห์',
        'รีเซ็ตทุกเดือน',
        'ไม่รีเซ็ตอัตโนมัติ',
        'ถูกจำกัด',
        'ปิดใช้งาน',
        'ปริมาณการใช้งานที่แน่นอน (MB)',
        'ใช้ข้อมูลครบตามขีดจำกัดแล้ว'
    ]
}
const keys = Object.keys(en) as (keyof Copy)[]
for (const [locale, values] of Object.entries(extra)) {
    copy[locale] = Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Copy
}
export const getTrafficCopy = (locale: string): Copy => copy[locale] ?? en
export function getResetCaption(strategy: string, locale: string, createdAt?: string): string {
    const labels = getTrafficCopy(locale)
    switch (strategy) {
        case 'DAY':
            return labels.daily
        case 'WEEK':
            return labels.weekly
        case 'MONTH':
        case 'MONTH_ROLLING': {
            const day = createdAt ? new Date(createdAt).getUTCDate() : NaN
            if (Number.isFinite(day)) {
                if (locale === 'ru') return `Сброс ${day} числа ежемесячно`
                if (locale === 'en') return `Resets on day ${day} of every month`
            }
            return labels.monthly
        }
        default:
            return labels.noReset
    }
}
