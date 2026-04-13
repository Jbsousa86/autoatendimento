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

    async uploadImage(file, fileName) {
        const { data, error } = await supabase.storage.from('produtos').upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data: publicData } = supabase.storage.from('produtos').getPublicUrl(fileName);
        return publicData.publicUrl;
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
        try {
            let allData = []
            let hasMore = true
            let page = 0
            const limit = 1000

            while (hasMore) {
                let query = supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(page * limit, (page + 1) * limit - 1)

                if (startDate && endDate) {
                    query = query.gte('created_at', startDate).lte('created_at', endDate)
                }

                const { data, error } = await query

                if (error) {
                    console.error("❌ Erro Supabase (getOrders):", error)
                    // Se a coluna nova estiver dando erro no SELECT, tentamos sem ela como último recurso
                    if (error.message.includes("payment_method")) {
                        let fallbackQuery = supabase.from('orders')
                            .select('id, created_at, order_number, customer_name, total, items, status, cashier_name, observation, customer_address')
                            .order('created_at', { ascending: false })
                            .range(page * limit, (page + 1) * limit - 1)
                        
                        if (startDate && endDate) {
                            fallbackQuery = fallbackQuery.gte('created_at', startDate).lte('created_at', endDate)
                        }
                        const fallback = await fallbackQuery
                        if (fallback.data && fallback.data.length > 0) {
                            allData = [...allData, ...fallback.data]
                            if (fallback.data.length < limit) hasMore = false
                            else page++
                            continue
                        }
                    }
                    break
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data]
                    if (data.length < limit) {
                        hasMore = false
                    } else {
                        page++
                    }
                } else {
                    hasMore = false
                }
            }
            return allData.map(o => ({ ...o, items: Array.isArray(o.items) ? o.items : [] }))
        } catch (err) {
            console.error("❌ Erro Crítico (getOrders):", err)
            return []
        }
    },

    async createOrder(orderData) {

        const newOrder = {
            order_number: String(orderData.orderNumber),
            customer_name: orderData.customerName || "Cliente",
            total: Number(orderData.total),
            items: orderData.items,
            status: 'pending',
            cashier_name: orderData.cashierName || null,
      payment_method: orderData.paymentMethod || null,
      change_amount: orderData.changeAmount || null,
      observation: orderData.observation || null,
      customer_address: orderData.customerAddress || null,
      customer_phone: orderData.customerPhone || null
    }

    // Tenta o salvamento completo
    let response = await supabase.from('orders').insert([newOrder]).select()

    // Fallback robusto: Se houver erro de coluna inexistente, tenta salvar o básico
    if (response.error && (response.error.code === '42703' || response.error.message?.includes("column"))) {
      // Prepara um nome que já inclua o endereço e observação se as colunas falharem
      let fallbackName = newOrder.customer_name;
      if (newOrder.customer_phone) fallbackName += ` [Tel: ${newOrder.customer_phone}]`;
      if (newOrder.customer_address) fallbackName += ` (${newOrder.customer_address})`;
      if (newOrder.observation) fallbackName += ` [Obs: ${newOrder.observation}]`;

      // Campos mínimos garantidos (versões iniciais do banco)
      const finalMinOrder = {
        order_number: newOrder.order_number,
        customer_name: fallbackName,
        total: newOrder.total,
        items: newOrder.items,
        status: newOrder.status,
        cashier_name: newOrder.cashier_name,
        // NÃO incluímos customer_address nem observation aqui pois sabemos que podem falhar
      }

      // Tenta salvar incluindo o payment_method se o erro não foi nele
      const isPaymentError = (response.error.message || "").includes("payment_method");
      if (!isPaymentError) {
        try {
          response = await supabase.from('orders').insert([{ ...finalMinOrder, payment_method: newOrder.payment_method }]).select();
        } catch (e) {
          response = await supabase.from('orders').insert([finalMinOrder]).select();
        }
      } else {
        response = await supabase.from('orders').insert([finalMinOrder]).select();
      }
    }

        if (response.error) {
            console.error("❌ ERRO SUPABASE AO SALVAR:", response.error)
            return { error: response.error }
        }

        const data = response.data ? response.data[0] : null
        return { data }
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
        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                },
                (payload) => { callback(payload) }
            )
            .subscribe()

        return channel
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
            .insert([{ name, password, can_view_reports: false }])

        if (error) {
            // Fallback caso a coluna não exista ainda
            if (error.message.includes("can_view_reports")) {
                const { error: error2 } = await supabase
                    .from('cashiers')
                    .insert([{ name, password }])
                if (error2) throw error2
                return
            }
            throw error
        }
    },

    async updateCashier(id, updates) {
        const { error } = await supabase
            .from('cashiers')
            .update(updates)
            .eq('id', id)

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

// ==========================================
// ❤️ SERVIÇO DE FIDELIDADE
// ==========================================
// ==========================================
// 📞 UTILITÁRIOS DE TELEFONE
// ==========================================
export const phoneUtils = {
    /**
     * Extrai número de telefone de um texto usando várias estratégias
     * Busca por: (11987654321), 11987654321, 11 98765-4321, etc
     */
    extractPhoneFromText(text) {
        if (!text) return null
        
        // Remove espaços e normaliza
        const cleaned = text.toString().replace(/\s+/g, ' ')
        
        // Estratégia 1: Procura por números entre parênteses ou colchetes
        // Ex: "João Silva (11987654321)" ou "João [11987654321]"
        const bracketMatch = cleaned.match(/[\(\[](\d{10,11})[\)\]]/);
        if (bracketMatch) {
            return bracketMatch[1];
        }
        
        // Estratégia 2: Procura após hífen ou pipe
        // Ex: "João Silva - 11987654321" ou "João | 11987654321"
        const dashMatch = cleaned.match(/[-|]\s*(\d{10,11})/);
        if (dashMatch) {
            return dashMatch[1];
        }
        
        // Estratégia 3: Procura por sequência de 10-11 dígitos
        const digitMatch = cleaned.match(/\d{10,11}/);
        if (digitMatch) {
            return digitMatch[0];
        }
        
        return null;
    },

    /**
     * Detecta se é um pedido via WhatsApp pela ordem ou pelo campo payment_method
     */
    isWhatsAppOrder(order) {
        if (!order) return false;
        const paymentMethod = (order.payment_method || order.paymentMethod || '').toLowerCase();
        return paymentMethod === 'whatsapp' || paymentMethod.startsWith('online_whatsapp');
    },

    /**
     * Extrai/detecta número de telefone automaticamente do pedido
     * Prioridade: 
     * 1. Campo customer_phone (já fornecido)
     * 2. Número do WhatsApp (quando vem via API)
     * 3. Extrai do nome do cliente
     * 4. Extrai do endereço
     */
    autoDetectPhoneFromOrder(order) {
        if (!order) return null;
        
        // 1. Se já tem o número, retorna
        if (order.customer_phone) {
            return order.customer_phone;
        }
        
        // 2. Se for WhatsApp, tenta extrair do nome ou endereço
        if (this.isWhatsAppOrder(order)) {
            // Tenta extrair do nome do cliente
            const namePhone = this.extractPhoneFromText(order.customer_name);
            if (namePhone) return namePhone;
            
            // Tenta extrair do endereço
            const addressPhone = this.extractPhoneFromText(order.customer_address);
            if (addressPhone) return addressPhone;
            
            // Tenta extrair da observação
            const obsPhone = this.extractPhoneFromText(order.observation);
            if (obsPhone) return obsPhone;
        }
        
        // 3. Fallback para pedidos antigos com telefone no nome
        const fallbackPhoneMatch = order.customer_name?.match(/\[Tel:\s*([^\]]+)\]/i);
        if (fallbackPhoneMatch) return this.extractPhoneFromText(fallbackPhoneMatch[1]);

        return null;
    }
}

// ==========================================
export const loyaltyService = {
    async getCustomerByPhone(phone) {
        const cleanPhone = phone.replace(/\D/g, '')
        
        const { data, error } = await supabase
            .from('loyalty_customers')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle()

        if (error) {
            console.error("Erro ao buscar cliente:", error)
            return null
        }
        return data
    },

    async createOrUpdateCustomer(phone, total, discountToRedeem = 0) {
        const cleanPhone = phone.replace(/\D/g, '')
        
        // Calcula pontos: 1 ponto a cada R$ 1,00 gasto
        const pointsToAdd = Math.floor(total)

        // Primeiro tenta buscar o cliente
        const existing = await this.getCustomerByPhone(cleanPhone)

        if (existing) {
            let pointsToRedeem = 0;
            if (discountToRedeem > 0) {
                pointsToRedeem = discountToRedeem * 20;
            }
            
            const finalPoints = existing.loyalty_points + pointsToAdd - pointsToRedeem;
            // Cliente existe, atualizar pontos
            const { error } = await supabase
                .from('loyalty_customers')
                .update({
                    loyalty_points: finalPoints,
                    last_purchase: new Date().toISOString()
                })
                .eq('id', existing.id)

            if (error) {
                console.error("Erro ao atualizar pontos:", error)
                return null
            }

            // Registra a transação de ganho de pontos
            if (pointsToAdd > 0) {
                await supabase
                    .from('loyalty_transactions')
                    .insert([{
                        customer_id: existing.id,
                        type: 'purchase',
                        points: pointsToAdd,
                        discount_amount: 0,
                        created_at: new Date().toISOString()
                    }])
            }
            // Registra a transação de resgate se houver
            if (pointsToRedeem > 0) {
                await supabase
                    .from('loyalty_transactions')
                    .insert([{
                        customer_id: existing.id,
                        type: 'redemption',
                        points: -pointsToRedeem,
                        discount_amount: discountToRedeem,
                        created_at: new Date(Date.now() + 1000).toISOString() // +1s para não confundir a ordem
                    }])
            }

            return { ...existing, loyalty_points: finalPoints }
        } else {
            // Novo cliente
            const { data, error } = await supabase
                .from('loyalty_customers')
                .insert([{
                    phone: cleanPhone,
                    loyalty_points: pointsToAdd,
                    created_at: new Date().toISOString(),
                    last_purchase: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) {
                console.error("Erro ao criar cliente:", error)
                return null
            }
            if (pointsToAdd > 0) {
                await supabase
                    .from('loyalty_transactions')
                    .insert([{
                        customer_id: data.id,
                        type: 'purchase',
                        points: pointsToAdd,
                        discount_amount: 0,
                        created_at: new Date().toISOString()
                    }])
            }
            return data
        }
    },

    async redeemPoints(customerId, discount) {
        try {
            // Primeira busca o cliente para pegar os pontos atuais
            const { data: customer, error: fetchError } = await supabase
                .from('loyalty_customers')
                .select('loyalty_points')
                .eq('id', customerId)
                .single()

            if (fetchError || !customer) {
                console.error("Erro ao buscar cliente:", fetchError)
                return null
            }

            // Calcula pontos gastos: R$ 0,05 por ponto (ou seja, 20 pontos = R$ 1,00)
            const pointsToRedeem = discount * 20

            if (customer.loyalty_points < pointsToRedeem) {
                console.error("Pontos insuficientes")
                return null
            }

            // Atualiza os pontos (subtrai)
            const { error } = await supabase
                .from('loyalty_customers')
                .update({
                    loyalty_points: customer.loyalty_points - pointsToRedeem
                })
                .eq('id', customerId)

            if (error) {
                console.error("Erro ao resgatar pontos:", error)
                return null
            }

            // Registra a transação
            await supabase
                .from('loyalty_transactions')
                .insert([{
                    customer_id: customerId,
                    type: 'redemption',
                    points: -pointsToRedeem,
                    discount_amount: discount,
                    created_at: new Date().toISOString()
                }])

            return true
        } catch (error) {
            console.error("Erro crítico ao resgatar:", error)
            return null
        }
    },

    async getCustomerStats(phone) {
        const customer = await this.getCustomerByPhone(phone)
        if (!customer) return null

        const { data: transactions, error } = await supabase
            .from('loyalty_transactions')
            .select('*')
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false })
            .limit(10)

        return {
            customer,
            transactions: error ? [] : transactions
        }
    },

    // ADMIN FUNCTIONS
    async getAllCustomers() {
        const { data, error } = await supabase
            .from('loyalty_customers')
            .select('*')
            .order('loyalty_points', { ascending: false })

        if (error) {
            console.error("Erro ao buscar clientes:", error)
            return []
        }
        return data || []
    },

    async updateCustomerPoints(customerId, newPoints) {
        const { error } = await supabase
            .from('loyalty_customers')
            .update({ loyalty_points: newPoints })
            .eq('id', customerId)

        if (error) {
            console.error("Erro ao atualizar pontos:", error)
            return null
        }
        return true
    },

    async deleteCustomer(customerId) {
        // Remove transações primeiro
        await supabase
            .from('loyalty_transactions')
            .delete()
            .eq('customer_id', customerId)

        // Remove cliente
        const { error } = await supabase
            .from('loyalty_customers')
            .delete()
            .eq('id', customerId)

        if (error) {
            console.error("Erro ao deletar cliente:", error)
            return null
        }
        return true
    },

    async addBonusPoints(customerId, points, reason = 'cortesia') {
        try {
            // Busca pontos atuais
            const { data: customer, error: fetchError } = await supabase
                .from('loyalty_customers')
                .select('loyalty_points')
                .eq('id', customerId)
                .single()

            if (fetchError || !customer) return null

            // Adiciona pontos
            const newPoints = customer.loyalty_points + points
            const { error } = await supabase
                .from('loyalty_customers')
                .update({ loyalty_points: newPoints })
                .eq('id', customerId)

            if (error) return null

            // Registra transação
            await supabase
                .from('loyalty_transactions')
                .insert([{
                    customer_id: customerId,
                    type: 'bonus',
                    points: points,
                    discount_amount: 0,
                    created_at: new Date().toISOString()
                }])

            return true
        } catch (error) {
            console.error("Erro ao adicionar bônus:", error)
            return null
        }
    },

    async getTransactionHistory(page = 0) {
        const limit = 50
        const offset = page * limit

        const { data, error } = await supabase
            .from('loyalty_transactions')
            .select('*, loyalty_customers(phone)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error("Erro ao buscar histórico:", error)
            return []
        }
        return data || []
    }
}
