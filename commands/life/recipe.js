const axios = require("axios");
module.exports = {
    name: "recipe",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "What do you want to cook today, blood?" });
        try {
            const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
            const meal = res.data.meals[0];
            if (!meal) return sock.sendMessage(msg.key.remoteJid, { text: "Recipe not found!" });
            const text = `🍳 *WT6 KITCHEN: ${meal.strMeal}* 🍳\n\n🌍 *Origin:* ${meal.strArea}\n🏷️ *Category:* ${meal.strCategory}\n\n📖 *Instructions:* ${meal.strInstructions}\n\n🔗 *Video Guide:* ${meal.strYoutube}`;
            await sock.sendMessage(msg.key.remoteJid, { image: { url: meal.strMealThumb }, caption: text });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Kitchen API is busy." }); }
    }
};
