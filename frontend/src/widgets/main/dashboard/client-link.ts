export function formatClientLink(template: string, subscriptionUrl: string): string {
    const placeholder = template.indexOf('{{SUBSCRIPTION_LINK}}')
    const query = template.indexOf('?')
    return template.replaceAll(
        '{{SUBSCRIPTION_LINK}}',
        query >= 0 && query < placeholder ? encodeURIComponent(subscriptionUrl) : subscriptionUrl
    )
}
