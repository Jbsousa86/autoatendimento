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
    async getOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error("Erro ao buscar pedidos:", error)
            return []
        }
        return data || []
    },

    async createOrder(orderData) {
        const newOrder = {
            order_number: String(orderData.orderNumber), // FIX: Usar orderNumber gerado no Context
            customer_name: orderData.customerName || "Cliente",
            total: orderData.total,
            items: orderData.items,
            status: 'pending'
        }

        const { error } = await supabase
            .from('orders')
            .insert([newOrder])

        if (error) console.error("Erro ao criar pedido:", error)
    },

    async updateStatus(orderId, newStatus) {
        // Encontrar o pedido pelo order_number (que estamos usando como ID visual)
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('order_number', orderId)

        if (error) console.error("Erro ao atualizar status:", error)
    },

    async deleteAllOrders() {
        // Limpar TODOS os pedidos (Zerar o dia)
        const { error } = await supabase
            .from('orders')
            .delete()
            .gt('id', -1) // Truque para pegar todos (ID > -1)

        if (error) console.error("Erro ao limpar pedidos:", error)
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
