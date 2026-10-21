import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export const DEFAULT_ACAI_SETTINGS = {
    id: 1,
    price_per_kg: 60.00,
    ice_cream_price_per_kg: 50.00,
    acai_image: '',
    ice_cream_image: '',
    min_grams: 300,
    step_grams: 50,
    weight_options: [300, 400, 500, 750, 1000],
    whatsapp_number: '',
    is_open: true
}

export const DEFAULT_ACAI_ADDONS = [
    { id: 1, name: 'Leite Condensado', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 1 },
    { id: 2, name: 'Leite em Pó (Ninho)', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 2 },
    { id: 3, name: 'Paçoca', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 3 },
    { id: 4, name: 'Granola', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 4 },
    { id: 5, name: 'Banana', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 5 },
    { id: 6, name: 'Calda de Chocolate', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 6 },
    { id: 7, name: 'Calda de Morango', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 7 },
    { id: 8, name: 'Granulado / Confete', type: 'incluso', price: 0, image: '', out_of_stock: false, sort_order: 8 },
    { id: 9, name: 'Morango Fruta', type: 'pago', price: 4.00, image: '', out_of_stock: false, sort_order: 9 },
    { id: 10, name: 'Creme de Avelã (Nutella)', type: 'pago', price: 5.00, image: '', out_of_stock: false, sort_order: 10 },
]

export const DEFAULT_ACAI_FLAVORS = [
    { id: 1, name: 'Chocolate', category: 'sorvete', image: '', out_of_stock: false, sort_order: 1 },
    { id: 2, name: 'Morango', category: 'sorvete', image: '', out_of_stock: false, sort_order: 2 },
    { id: 3, name: 'Flocos', category: 'sorvete', image: '', out_of_stock: false, sort_order: 3 },
    { id: 4, name: 'Ninho Trufado', category: 'sorvete', image: '', out_of_stock: false, sort_order: 4 },
    { id: 5, name: 'Creme / Baunilha', category: 'sorvete', image: '', out_of_stock: false, sort_order: 5 },
    { id: 6, name: 'Maracujá', category: 'sorvete', image: '', out_of_stock: false, sort_order: 6 },
]

export const DEFAULT_ACAI_CUPS = [
    {
        id: 1,
        name: 'Copo de Açaí 300ml',
        category: 'acai',
        size_ml: 300,
        description: 'Açaí tradicional, leite condensado, leite em pó e granola',
        price: 15.00,
        image: '',
        out_of_stock: false,
        sort_order: 1
    },
    {
        id: 2,
        name: 'Copo de Açaí 400ml',
        category: 'acai',
        size_ml: 400,
        description: 'Açaí tradicional, leite condensado, leite em pó, paçoca e granola',
        price: 19.00,
        image: '',
        out_of_stock: false,
        sort_order: 2
    },
    {
        id: 3,
        name: 'Copo de Açaí 500ml',
        category: 'acai',
        size_ml: 500,
        description: 'Açaí tradicional, leite condensado, leite em pó, morango, paçoca e granola',
        price: 24.00,
        image: '',
        out_of_stock: false,
        sort_order: 3
    },
    {
        id: 4,
        name: 'Casquinha 1 Bola',
        category: 'sorvete',
        size_ml: 100,
        description: 'Casquinha crocante com 1 bola de sorvete à escolha e calda',
        price: 6.00,
        image: '',
        out_of_stock: false,
        sort_order: 4
    },
    {
        id: 5,
        name: 'Cascão 2 Bolas',
        category: 'sorvete',
        size_ml: 200,
        description: 'Cascão recheado com 2 bolas de sorvete à escolha e cobertura',
        price: 12.00,
        image: '',
        out_of_stock: false,
        sort_order: 5
    },
    {
        id: 6,
        name: 'Copo de Sorvete 400ml',
        category: 'sorvete',
        size_ml: 400,
        description: 'Sorvete montado com até 3 sabores, calda e acompanhamentos',
        price: 16.00,
        image: '',
        out_of_stock: false,
        sort_order: 6
    },
    {
        id: 7,
        name: 'Milkshake 400ml',
        category: 'sorvete',
        size_ml: 400,
        description: 'Milkshake cremoso batido com sorvete e calda',
        price: 18.00,
        image: '',
        out_of_stock: false,
        sort_order: 7
    }
]

export const acaiService = {
    // ==========================================
    // 📷 UPLOAD DE IMAGEM PARA SUPABASE STORAGE
    // ==========================================
    async uploadImage(file) {
        if (!file) return ''
        const safeName = `acai_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`
        try {
            const { error } = await supabase.storage
                .from('produtos')
                .upload(safeName, file, { cacheControl: '3600', upsert: true })

            if (error) throw error

            const { data: publicData } = supabase.storage
                .from('produtos')
                .getPublicUrl(safeName)

            return publicData.publicUrl
        } catch (err) {
            console.warn('Bucket produtos indisponível, convertendo imagem localmente:', err)
            return await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = (e) => reject(e)
                reader.readAsDataURL(file)
            })
        }
    },

    // ==========================================
    // ⚙️ CONFIGURAÇÕES DO AÇAÍ E SORVETE (acai_settings)
    // ==========================================
    async getSettings() {
        try {
            const { data, error } = await supabase
                .from('acai_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle()

            let fallbackWhatsapp = ''
            if (!data?.whatsapp_number) {
                const { data: globalWa } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'whatsapp')
                    .maybeSingle()
                if (globalWa?.value) fallbackWhatsapp = globalWa.value
            }

            if (error || !data) {
                return {
                    ...DEFAULT_ACAI_SETTINGS,
                    whatsapp_number: fallbackWhatsapp,
                    _fromFallback: Boolean(error)
                }
            }

            return {
                ...DEFAULT_ACAI_SETTINGS,
                ...data,
                price_per_kg: Number(data.price_per_kg ?? DEFAULT_ACAI_SETTINGS.price_per_kg),
                ice_cream_price_per_kg: Number(
                    data.ice_cream_price_per_kg ?? data.price_per_kg ?? DEFAULT_ACAI_SETTINGS.ice_cream_price_per_kg
                ),
                acai_image: data.acai_image || '',
                ice_cream_image: data.ice_cream_image || '',
                min_grams: Number(data.min_grams ?? DEFAULT_ACAI_SETTINGS.min_grams),
                step_grams: Number(data.step_grams ?? DEFAULT_ACAI_SETTINGS.step_grams),
                weight_options: Array.isArray(data.weight_options)
                    ? data.weight_options.map(Number).filter(Boolean)
                    : DEFAULT_ACAI_SETTINGS.weight_options,
                whatsapp_number: data.whatsapp_number || fallbackWhatsapp || '',
                is_open: data.is_open ?? true
            }
        } catch (err) {
            console.error('Erro ao carregar configurações de açaí/sorvete:', err)
            return { ...DEFAULT_ACAI_SETTINGS, _fromFallback: true }
        }
    },

    async updateSettings(updates) {
        const payload = {
            id: 1,
            price_per_kg: Number(updates.price_per_kg ?? 60),
            ice_cream_price_per_kg: Number(updates.ice_cream_price_per_kg ?? updates.price_per_kg ?? 50),
            acai_image: (updates.acai_image || '').trim(),
            ice_cream_image: (updates.ice_cream_image || '').trim(),
            min_grams: Number(updates.min_grams ?? 300),
            step_grams: Number(updates.step_grams ?? 50),
            weight_options: Array.isArray(updates.weight_options)
                ? updates.weight_options.map(Number).filter(n => n > 0)
                : DEFAULT_ACAI_SETTINGS.weight_options,
            whatsapp_number: (updates.whatsapp_number || '').trim(),
            is_open: Boolean(updates.is_open ?? true),
            updated_at: new Date().toISOString()
        }

        let response = await supabase
            .from('acai_settings')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single()

        if (response.error && response.error.code === '42703') {
            const fallbackPayload = { ...payload }
            delete fallbackPayload.ice_cream_price_per_kg
            delete fallbackPayload.acai_image
            delete fallbackPayload.ice_cream_image
            response = await supabase
                .from('acai_settings')
                .upsert(fallbackPayload, { onConflict: 'id' })
                .select()
                .single()
        }

        if (response.error) throw response.error
        return response.data
    },

    // ==========================================
    // 🍓 ACOMPANHAMENTOS / CALDAS (acai_addons)
    // ==========================================
    async getAddons() {
        try {
            const { data, error } = await supabase
                .from('acai_addons')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true })

            if (error) {
                console.warn('Tabela acai_addons indisponível, usando lista padrão:', error.message)
                return DEFAULT_ACAI_ADDONS
            }

            if (!data || data.length === 0) {
                return []
            }

            return data.map(item => ({
                ...item,
                price: Number(item.price || 0),
                image: item.image || '',
                out_of_stock: Boolean(item.out_of_stock)
            }))
        } catch (err) {
            console.error('Erro ao buscar adicionais:', err)
            return DEFAULT_ACAI_ADDONS
        }
    },

    async saveAddon(addon) {
        const isUpdate = Boolean(addon.id && Number(addon.id) < 1000000000000)
        const payload = {
            name: (addon.name || '').trim(),
            type: addon.type === 'pago' ? 'pago' : 'incluso',
            price: addon.type === 'pago' ? Number(addon.price || 0) : 0,
            image: (addon.image || '').trim(),
            out_of_stock: Boolean(addon.out_of_stock || false),
            sort_order: Number(addon.sort_order || 0)
        }

        let response = isUpdate
            ? await supabase.from('acai_addons').update(payload).eq('id', addon.id).select().single()
            : await supabase.from('acai_addons').insert([payload]).select().single()

        if (response.error && response.error.code === '42703') {
            const fallbackPayload = { ...payload }
            delete fallbackPayload.image
            response = isUpdate
                ? await supabase.from('acai_addons').update(fallbackPayload).eq('id', addon.id).select().single()
                : await supabase.from('acai_addons').insert([fallbackPayload]).select().single()
        }

        if (response.error) throw response.error
        return response.data
    },

    async deleteAddon(id) {
        const { error } = await supabase
            .from('acai_addons')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    // ==========================================
    // 🍦 SABORES DE SORVETE (acai_flavors)
    // ==========================================
    async getFlavors() {
        try {
            const { data, error } = await supabase
                .from('acai_flavors')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true })

            if (error) {
                console.warn('Tabela acai_flavors indisponível, usando sabores padrão:', error.message)
                return DEFAULT_ACAI_FLAVORS
            }

            if (!data || data.length === 0) {
                return []
            }

            return data.map(item => ({
                ...item,
                category: item.category || 'sorvete',
                image: item.image || '',
                out_of_stock: Boolean(item.out_of_stock)
            }))
        } catch (err) {
            console.error('Erro ao buscar sabores de sorvete:', err)
            return DEFAULT_ACAI_FLAVORS
        }
    },

    async saveFlavor(flavor) {
        const isUpdate = Boolean(flavor.id && Number(flavor.id) < 1000000000000)
        const payload = {
            name: (flavor.name || '').trim(),
            category: flavor.category === 'acai' ? 'acai' : 'sorvete',
            image: (flavor.image || '').trim(),
            out_of_stock: Boolean(flavor.out_of_stock || false),
            sort_order: Number(flavor.sort_order || 0)
        }

        let response = isUpdate
            ? await supabase.from('acai_flavors').update(payload).eq('id', flavor.id).select().single()
            : await supabase.from('acai_flavors').insert([payload]).select().single()

        if (response.error && response.error.code === '42703') {
            const fallbackPayload = { ...payload }
            delete fallbackPayload.image
            response = isUpdate
                ? await supabase.from('acai_flavors').update(fallbackPayload).eq('id', flavor.id).select().single()
                : await supabase.from('acai_flavors').insert([fallbackPayload]).select().single()
        }

        if (response.error) throw response.error
        return response.data
    },

    async deleteFlavor(id) {
        const { error } = await supabase
            .from('acai_flavors')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    // ==========================================
    // 🥤 COPOS PRONTOS, CASQUINHAS E SORVETES (acai_cups)
    // ==========================================
    async getCups() {
        try {
            const { data, error } = await supabase
                .from('acai_cups')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('size_ml', { ascending: true })

            if (error) {
                console.warn('Tabela acai_cups indisponível, usando lista padrão:', error.message)
                return DEFAULT_ACAI_CUPS
            }

            if (!data || data.length === 0) {
                return []
            }

            return data.map(item => ({
                ...item,
                category: item.category === 'sorvete' ? 'sorvete' : 'acai',
                size_ml: Number(item.size_ml || 300),
                price: Number(item.price || 0),
                image: item.image || '',
                out_of_stock: Boolean(item.out_of_stock)
            }))
        } catch (err) {
            console.error('Erro ao buscar copos prontos:', err)
            return DEFAULT_ACAI_CUPS
        }
    },

    async saveCup(cup) {
        const isUpdate = Boolean(cup.id && Number(cup.id) < 1000000000000)
        const payload = {
            name: (cup.name || '').trim(),
            category: cup.category === 'sorvete' ? 'sorvete' : 'acai',
            size_ml: Number(cup.size_ml || 300),
            description: (cup.description || '').trim(),
            price: Number(cup.price || 0),
            image: (cup.image || '').trim(),
            out_of_stock: Boolean(cup.out_of_stock || false),
            sort_order: Number(cup.sort_order || 0)
        }

        let response = isUpdate
            ? await supabase.from('acai_cups').update(payload).eq('id', cup.id).select().single()
            : await supabase.from('acai_cups').insert([payload]).select().single()

        if (response.error && response.error.code === '42703') {
            const fallbackPayload = { ...payload }
            delete fallbackPayload.category
            delete fallbackPayload.image
            response = isUpdate
                ? await supabase.from('acai_cups').update(fallbackPayload).eq('id', cup.id).select().single()
                : await supabase.from('acai_cups').insert([fallbackPayload]).select().single()
        }

        if (response.error) throw response.error
        return response.data
    },

    async deleteCup(id) {
        const { error } = await supabase
            .from('acai_cups')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    // ==========================================
    // 🧾 PEDIDOS DE AÇAÍ E SORVETE (acai_orders)
    // ==========================================
    async createOrder(orderData) {
        const newOrder = {
            order_number: String(orderData.orderNumber || Math.floor(Math.random() * 900) + 100),
            customer_name: (orderData.customerName || 'Cliente').trim(),
            customer_phone: (orderData.customerPhone || '').trim() || null,
            customer_address: (orderData.customerAddress || '').trim() || null,
            delivery_type: ['entrega', 'retirada', 'balcao'].includes(orderData.deliveryType)
                ? orderData.deliveryType
                : 'entrega',
            cashier_name: orderData.cashierName || null,
            payment_method: orderData.paymentMethod || null,
            change_amount: orderData.changeAmount ? Number(orderData.changeAmount) : null,
            observation: (orderData.observation || '').trim() || null,
            grams: Number(orderData.grams || 0),
            price_per_kg: Number(orderData.pricePerKg || 60),
            addons: Array.isArray(orderData.addons) ? orderData.addons : [],
            items: Array.isArray(orderData.items) ? orderData.items : [],
            total: Number(orderData.total || 0),
            status: orderData.status || 'pending'
        }

        let response = await supabase
            .from('acai_orders')
            .insert([newOrder])
            .select()
            .single()

        if (response.error && (response.error.code === '42703' || response.error.code === '23514')) {
            const fallbackOrder = { ...newOrder }
            delete fallbackOrder.cashier_name
            if (fallbackOrder.delivery_type === 'balcao') {
                fallbackOrder.delivery_type = 'retirada'
            }
            response = await supabase
                .from('acai_orders')
                .insert([fallbackOrder])
                .select()
                .single()
        }

        if (response.error) {
            console.error('❌ Erro ao salvar pedido em acai_orders:', response.error)
            return { error: response.error }
        }

        return { data: response.data }
    },

    async getOrders(limit = 100) {
        const { data, error } = await supabase
            .from('acai_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            console.error('Erro ao buscar pedidos de açaí/sorvete:', error)
            throw error
        }
        return data || []
    },

    async updateOrderStatus(id, status) {
        const { error } = await supabase
            .from('acai_orders')
            .update({ status })
            .eq('id', id)

        if (error) throw error
    },

    async deleteOrder(id) {
        const { error } = await supabase
            .from('acai_orders')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    subscribeToOrders(callback) {
        const channel = supabase
            .channel('acai-orders-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'acai_orders'
                },
                (payload) => callback(payload)
            )
            .subscribe()

        return {
            unsubscribe: () => supabase.removeChannel(channel)
        }
    }
}
