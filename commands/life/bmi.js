module.exports = {
    name: "bmi",
    async execute(sock, msg, args) {
        if (!args[1]) return sock.sendMessage(msg.key.remoteJid, { text: "Use: .bmi [weight_kg] [height_m]\nEx: .bmi 70 1.7" });
        const weight = parseFloat(args[0]);
        const height = parseFloat(args[1]);
        const bmi = (weight / (height * height)).toFixed(1);
        let category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
        await sock.sendMessage(msg.key.remoteJid, { text: `🏥 *BMI ANALYSIS*\n\nScore: ${bmi}\nCategory: ${category}\n\n_Health is wealth by STANYTZ._` });
    }
};
