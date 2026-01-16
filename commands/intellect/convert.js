module.exports = {
    name: "convert",
    async execute(sock, msg, args) {
        if (args.length < 3) return sock.sendMessage(msg.key.remoteJid, { text: "Usage: .convert [value] [from] [to]\nExample: .convert 100 kg lbs" });
        const val = parseFloat(args[0]);
        const from = args[1].toLowerCase();
        const to = args[2].toLowerCase();
        let res = 0;

        // Logic Simple Conversion
        if (from === "kg" && to === "lbs") res = (val * 2.20462).toFixed(2);
        else if (from === "km" && to === "miles") res = (val * 0.621371).toFixed(2);
        else if (from === "c" && to === "f") res = ((val * 9/5) + 32).toFixed(2);
        else if (from === "mb" && to === "gb") res = (val / 1024).toFixed(3);
        else return sock.sendMessage(msg.key.remoteJid, { text: "Units not supported yet. Try: kg, lbs, km, miles, c, f, mb, gb." });

        await sock.sendMessage(msg.key.remoteJid, { text: `📏 *CONVERSION RESULT* 📏\n\n*Input:* ${val} ${from}\n*Output:* ${res} ${to}\n\n_Calculation by WRONG TURN 6_` });
    }
};
