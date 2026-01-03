import { createClient } from '@supabase/supabase-js'

// ==========================================
// 🔌 CONEXÃO COM SUPABASE
// ==========================================
// As chaves agora estão protegidas no arquivo .env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ==========================================
// 📦 SERVIÇO DE PRODUTOS
// ==========================================
export const productService = {
    async getProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name')

        if (error) {
            console.error("Erro ao buscar produtos:", error)
            return []
        }
        return data || []
    },

    async saveProduct(product) {
        // Se tem ID, é atualização. Se não (ou se for temp timestamp), é criação.
        // O Supabase gera ID automático se mandarmos sem ID.
        // Vamos remover o ID se ele for um timestamp (criado localmente pelo Date.now())
        const isNew = !product.id || product.id.toString().length > 10

        const productToSave = {
            name: product.name,
            price: parseFloat(product.price),
            // Envia null se estiver vazio ou 0, para cair na lógica de cálculo automático
            price_p: product.price_p ? parseFloat(product.price_p) : null,
            price_g: product.price_g ? parseFloat(product.price_g) : null,
            description: product.description,
            image: product.image,
            category: product.category
        }

        if (!isNew) {
            // Atualizar
            const { error } = await supabase
                .from('products')
                .update(productToSave)
                .eq('id', product.id)
            if (error) throw error
        } else {
            // Criar
            const { error } = await supabase
                .from('products')
                .insert([productToSave])
            if (error) throw error
        }
    },

    async deleteProduct(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)

        if (error) console.error("Erro ao deletar:", error)
    }
}

// ==========================================
// 🧾 SERVIÇO DE PEDIDOS
// ==========================================
export const orderService = {
    async getOrders(startDate, endDate) {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })

        if (startDate && endDate) {
            query = query.gte('created_at', startDate).lte('created_at', endDate)
        }

        const { data, error } = await query

        if (error) {
            console.error("Erro ao buscar pedidos:", error)
            return []
        }
        return data || []
    },

    async createOrder(orderData) {
        const newOrder = {
            order_number: String(orderData.orderNumber),
            customer_name: orderData.observation
                ? `${orderData.customerName || "Cliente"} (${orderData.observation})`
                : (orderData.customerName || "Cliente"),
            total: orderData.total,
            items: orderData.items,
            status: 'pending',
            cashier_name: orderData.cashierName || null,
            payment_method: orderData.paymentMethod || null
        }

        const { data, error } = await supabase
            .from('orders')
            .insert([newOrder])
            .select()

        if (error) {
            console.error("Erro ao criar pedido:", error)
            return null
        }
        return data ? data[0] : null
    },

    async updateOrderName(id, newName) {
        const { error } = await supabase
            .from('orders')
            .update({ customer_name: newName || "Cliente" })
            .eq('id', id)

        if (error) console.error("Erro ao atualizar nome:", error)
    },

    async updateStatus(id, newStatus) {
        // Atualiza pelo ID único (UUID) para evitar colisão de números de pedido
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', id)

        if (error) console.error("Erro ao atualizar status:", error)
    },

    async archiveAllOrders() {
        // Arquivar TODOS os pedidos ativos (Limpar a tela da cozinha, manter no histórico)
        const { error } = await supabase
            .from('orders')
            .update({ status: 'finished' })
            .in('status', ['pending', 'preparing', 'ready'])

        if (error) console.error("Erro ao arquivar pedidos:", error)
    },

    async deleteOrder(id) {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id)

        if (error) {
            console.error("Erro ao deletar pedido:", error)
            throw error
        }
    },

    // INSCRIÇÃO EM TEMPO REAL (Para a Cozinha!)
    subscribeToOrders(callback) {
        console.log("🔌 Iniciando conexão Realtime com Supabase...")
        return supabase
            .channel('realtime-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                console.log('🔔 Mudança detectada no banco!', payload)
                callback(payload) // Passamos o payload para saber se foi INSERT
            })
            .subscribe((status) => {
                console.log("📡 Status da conexão Realtime:", status)
            })
    }
}
// ==========================================
// 👤 SERVIÇO DE CAIXAS (USERS)
// ==========================================
export const cashierService = {
    async getCashiers() {
        const { data, error } = await supabase
            .from('cashiers')
            .select('*')
            .order('name')

        if (error) {
            console.error("Erro ao buscar caixas:", error)
            return []
        }
        return data || []
    },

    async createCashier(name, password) {
        const { error } = await supabase
            .from('cashiers')
            .insert([{ name, password }])

        if (error) throw error
    },

    async deleteCashier(id) {
        const { error } = await supabase
            .from('cashiers')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async login(name, password) {
        const { data, error } = await supabase
            .from('cashiers')
            .select('*')
            .eq('name', name)
            .single()

        if (error || !data) return null

        // Em um app real, usaríamos hash (bcrypt). Aqui é comparação simples.
        if (data.password === password) return data
        return null
    }
}

// ==========================================
// ⚙️ SERVIÇO DE CONFIGURAÇÕES (SETTINGS)
// ==========================================
export const configService = {
    async getSettings() {
        const { data, error } = await supabase
            .from('settings')
            .select('*')

        if (error) {
            console.error("Erro ao buscar configurações:", error)
            // Retorna um padrão caso a tabela não exista ou ocorra erro
            return [{ key: 'hours', value: '18:00 — 00:00' }]
        }
        return data || []
    },

    async updateSetting(key, value) {
        const { error } = await supabase
            .from('settings')
            .upsert({ key, value })

        if (error) {
            console.error("Erro ao atualizar configuração:", error)
            throw error
        }
    }
}
