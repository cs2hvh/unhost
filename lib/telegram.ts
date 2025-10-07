export async function sendAdminNotification(message: string): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

    if (!botToken || !adminChatId) {
        console.warn('Telegram bot token or admin chat ID not configured')
        return false
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: adminChatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: false,
            }),
        })

        const result = await response.json()

        if (!response.ok) {
            console.error('Telegram notification failed:', result)
            return false
        }

        return true
    } catch (error) {
        console.error('Error sending Telegram admin notification:', error)
        return false
    }
}

// Helper functions for specific notification types
export const adminNotifications = {
    async depositPaid(userId: string, amount: number, newBalance: number) {
        const userLink = `<a href="https://uncash.io/admin/users/${userId}">${userId}</a>`
        const message = `<b>Deposit Paid</b>\n\nUser: ${userLink}\nAmount: $${amount.toFixed(2)}\nNew Balance: $${newBalance.toFixed(2)}`
        return sendAdminNotification(message)
    },

    async partialDeposit(userId: string, amount: number, expected: number) {
        const userLink = `<a href="https://uncash.io/admin/users/${userId}">${userId}</a>`
        const message = `<b>Partial Deposit</b>\n\nUser: ${userLink}\nAmount: $${amount.toFixed(2)}\nNew Balance: $${expected.toFixed(2)}`
        return sendAdminNotification(message)
    },

    async newTicket(ticketId: number, userId: string, username: string, title: string) {
        const userLink = `<a href="https://uncash.io/admin/users/${userId}">${username}</a>`
        const ticketLink = `<a href="https://uncash.io/admin/tickets/${ticketId}">#${ticketId}</a>`
        const message = `<b>New Support Ticket</b>\n\nTicket: ${ticketLink}\nUser: ${userLink}\nTitle: ${title}`
        return sendAdminNotification(message)
    },

    async walletBalanceAlert(balance: number, cardsBalance: number, availableBalance: number, threshold: number) {
        const message = `<b>Low Wallet Balance Alert</b>\n\nAvailable Balance: $${balance.toFixed(2)}\n\nWallet balance is below $${threshold.toFixed(2)} threshold!`
        return sendAdminNotification(message)
    },

    async negativeBalanceHandled(cardCount: number, totalProcessed: number, summary: Array<{ action: string, count: number, totalAmount: number }>) {
        let message = `<b>Negative Balance Cards Handled</b>\n\n`
        message += `Found: ${cardCount} cards with negative balance\n`
        message += `Processed: ${totalProcessed} cards\n\n`

        summary.forEach(item => {
            if (item.count > 0) {
                const actionText = item.action === 'wallet_transfer' ? 'Wallet Transfer' :
                    item.action === 'card_closed' ? 'Card Closed' :
                        item.action === 'card_closed_with_recovery' ? 'Card Closed with Recovery' : item.action
                message += `${actionText}: ${item.count} cards, $${item.totalAmount.toFixed(2)}\n`
            }
        })

        return sendAdminNotification(message)
    },

    async negativeBalanceError(cardId: string, userId: string, error: string) {
        const userLink = `<a href="https://uncash.io/admin/users/${userId}">${userId}</a>`
        const message = `<b>Negative Balance Error</b>\n\nCard: ${cardId}\nUser: ${userLink}\nError: ${error}`
        return sendAdminNotification(message)
    }
}