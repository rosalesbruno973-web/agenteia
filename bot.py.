import os
import json
import logging
from datetime import datetime
from telegram import Update
from telegram.ext import Application, MessageHandler, CommandHandler, filters, ContextTypes
import anthropic

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Clientes
claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# Banco de dados simples em JSON local
DB_FILE = "financas.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {}

def save_db(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

def get_user_data(user_id: str):
    db = load_db()
    if user_id not in db:
        db[user_id] = {"transactions": [], "goals": [], "budgets": {}, "history": []}
        save_db(db)
    return db[user_id]

def save_user_data(user_id: str, data: dict):
    db = load_db()
    db[user_id] = data
    save_db(db)

CATEGORIES = ["Mercado", "Lazer", "Saúde", "Transporte", "Moradia", "Alimentação", "Educação", "Roupas", "Outros"]

def build_system_prompt(user_data: dict) -> str:
    current_month = datetime.now().strftime("%Y-%m")
    transactions = user_data.get("transactions", [])
    monthly = [t for t in transactions if t.get("date", "").startswith(current_month)]
    
    income = sum(t["amount"] for t in monthly if t["type"] == "receita")
    expense = sum(t["amount"] for t in monthly if t["type"] == "despesa")
    balance = income - expense

    by_category = {}
    for t in monthly:
        if t["type"] == "despesa":
            by_category[t["category"]] = by_category.get(t["category"], 0) + t["amount"]

    budgets = user_data.get("budgets", {})
    alerts = [f"{c}: gastou R${by_category.get(c,0):.2f} de R${budgets[c]:.2f} (ULTRAPASSADO)"
              for c in budgets if budgets[c] > 0 and by_category.get(c, 0) > budgets[c]]

    return f"""Você é um agente financeiro pessoal dentro do Telegram. Responda APENAS em JSON válido, sem texto fora do JSON.

CONTEXTO FINANCEIRO DO USUÁRIO:
Mês: {current_month} | Receitas: R${income:.2f} | Despesas: R${expense:.2f} | Saldo: R${balance:.2f}
Gastos por categoria: {json.dumps(by_category, ensure_ascii=False)}
Orçamentos definidos: {json.dumps(budgets, ensure_ascii=False)}
Alertas de limite: {'; '.join(alerts) if alerts else 'Nenhum'}
Metas: {json.dumps(user_data.get('goals', []), ensure_ascii=False)}
Últimas transações: {json.dumps(transactions[-5:], ensure_ascii=False)}
Categorias disponíveis: {', '.join(CATEGORIES)}
Data hoje: {datetime.now().strftime('%Y-%m-%d')}

==================================================
SUA PERSONALIDADE — ESTILO PABLO MARÇAL:
Você fala como Pablo Marçal. Coach. Direto. Provocador. Nunca consola, desafia.

REGRAS DE VOZ:
- Frases curtíssimas. Uma ideia por vez.
- Nunca valide desculpa. Jamais.
- Use a virada: o problema não é o dinheiro, é a decisão.
- Palavras de ordem: executa, age, para de reclamar, faz.
- Sempre termine com uma pergunta ou provocação.
- Máx 2 emojis por resposta — só quando reforçar o ponto.
- ZERO texto longo. ZERO enrolação.
- Nunca seja gentil demais. Seja útil de verdade.

EXEMPLOS DE TOM:
- "200 no bar. Quanto você guardou esse mês? Exato."
- "Sem dinheiro ou sem atitude? Diferença grande."
- "Quer ou vai fazer? Me fala o prazo."
- "Difícil é passar necessidade. Economizar é escolha."
- "Semana que vem não existe. O que você vai fazer agora?"
- "Carro é meta ou ego? Pensa."
- "Você tá construindo ou consumindo?"
==================================================

FUNÇÕES:

1. REGISTRO: Se o usuário registrar gasto ou entrada (ex: "gastei 50 no mercado", "recebi 1200"):
   Formato: {{"type":"transaction","transaction":{{"type":"despesa|receita","amount":número,"category":"categoria","description":"descrição","date":"YYYY-MM-DD"}},"message":"[valor] em [categoria]. [provocação curta ou pergunta que faz pensar]"}}

2. DIAGNÓSTICO: Sempre que houver dados, use os números reais e provoque:
   Ex: "Gastou R$X em lazer. Quanto disso virou ativo? Zero."

3. METAS: Se quiser guardar dinheiro (ex: "quero juntar 5000"):
   - Se não tiver prazo, pergunte de forma direta: "Em quanto tempo? Sem prazo é sonho."
   - Com prazo: calcule e provoque
   Formato: {{"type":"goal","goal":{{"name":"nome","target":valor,"saved":0}},"message":"R$Z por mês. Você consegue ou vai arrumar desculpa?"}}

4. LEMBRETES de conta: {{"type":"chat","message":"Anotado. Paga em dia. Juros é imposto dos desorganizados."}}

5. GAMIFICAÇÃO — quando o usuário acertar:
   Ex: "Isso. Consistência bate talento todo dia." / "Boa decisão. Continua."

6. RENDA EXTRA — se estiver no vermelho ou reclamar de dinheiro:
   Ex: "O problema pode não ser o gasto. Pode ser a renda. O que você faz além do trabalho?"

7. SIMULAÇÃO — "posso comprar isso?", "vale a pena?":
   Responda com impacto real + decisão direta. Ex: "Se comprar, seu saldo vai pra R$X. Vale esse preço? Você decide."

8. ORÇAMENTO: {{"type":"budget","category":"categoria","limit":valor,"message":"Limite definido. Agora respeita."}}

9. RESUMO/CONSULTA: {{"type":"chat","message":"[números reais] + [pergunta que confronta o comportamento]"}}

IMPORTANTE: Cada resposta deve fazer o usuário pensar ou agir. Se não fizer nenhum dos dois, reescreve."""

async def process_message(user_id: str, text: str) -> str:
    user_data = get_user_data(user_id)
    
    # Adiciona ao histórico de conversa (últimas 6 mensagens)
    history = user_data.get("history", [])
    history.append({"role": "user", "content": text})
    history = history[-6:]

    response = claude.messages.create(
        model="claude-opus-4-5",
        max_tokens=1000,
        system=build_system_prompt(user_data),
        messages=history,
    )

    raw = response.content[0].text
    try:
        clean = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
    except:
        return raw  # fallback texto puro

    reply = result.get("message", "Entendido!")

    # Processa ação
    if result["type"] == "transaction" and "transaction" in result:
        tx = result["transaction"]
        tx["id"] = int(datetime.now().timestamp() * 1000)
        user_data["transactions"].append(tx)

    elif result["type"] == "goal" and "goal" in result:
        goal = result["goal"]
        goal["id"] = int(datetime.now().timestamp() * 1000)
        user_data["goals"].append(goal)

    elif result["type"] == "budget":
        cat = result.get("category")
        limit = result.get("limit", 0)
        if cat:
            user_data["budgets"][cat] = limit

    # Salva histórico atualizado
    history.append({"role": "assistant", "content": reply})
    user_data["history"] = history[-6:]
    save_user_data(user_id, user_data)

    return reply

# --- Handlers do Telegram ---

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Olá! Sou seu *Agente Financeiro* pessoal!\n\n"
        "Pode me dizer:\n"
        "💸 *'gastei 50 no mercado'*\n"
        "💰 *'recebi 2000 de salário'*\n"
        "📊 *'como estão minhas finanças?'*\n"
        "🎯 *'quero economizar 500 para viagem'*\n"
        "📋 *'meu limite de lazer é 300'*\n\n"
        "Use /resumo para ver seu resumo mensal!\n"
        "Use /metas para ver suas metas.\n"
        "Use /historico para ver as últimas transações.",
        parse_mode="Markdown"
    )

async def resumo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    reply = await process_message(user_id, "me dê um resumo detalhado das minhas finanças deste mês")
    await update.message.reply_text(reply)

async def metas(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    reply = await process_message(user_id, "liste todas as minhas metas com o progresso atual")
    await update.message.reply_text(reply)

async def historico(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    user_data = get_user_data(user_id)
    transactions = user_data.get("transactions", [])[-10:]
    if not transactions:
        await update.message.reply_text("📋 Nenhuma transação registrada ainda.")
        return
    lines = ["📋 *Últimas transações:*\n"]
    for t in reversed(transactions):
        emoji = "💰" if t["type"] == "receita" else "💸"
        lines.append(f"{emoji} {t['description']} — R${t['amount']:.2f} ({t['category']}) — {t['date']}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    text = update.message.text
    
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")
    
    try:
        reply = await process_message(user_id, text)
        await update.message.reply_text(reply)
    except Exception as e:
        logger.error(f"Erro: {e}")
        await update.message.reply_text("❌ Ops, algo deu errado. Tente novamente!")

def main():
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = Application.builder().token(token).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("resumo", resumo))
    app.add_handler(CommandHandler("metas", metas))
    app.add_handler(CommandHandler("historico", historico))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    logger.info("Bot iniciado!")
    app.run_polling()

if __name__ == "__main__":
    main()
