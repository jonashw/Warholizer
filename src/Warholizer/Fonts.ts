
const fontNames = [
	"Permanent Marker",
	"Roboto",
	"Meddon",
	"Gaegu",
	"Sono",
	"Ultra",
	"Bebas Neue",
	"Staatliches",
	"Concert One",
	"Creepster",
	"Press Start 2P",
	"Special Elite",
	"Henny Penny",
	"Irish Grover",
	"Bungee Shade",
	"Eater",
	"Vast Shadow",
	"Finger Paint",
	"Blaka",
	"MedievalSharp"
]

const Fonts = {
	loadAll: async (): Promise<string[]> => 
		Promise.all(fontNames.map(fn => new Promise<string>((resolve,_) => {
			const link = document.createElement('link');
			link.rel = "stylesheet";
			link.href=`https://fonts.googleapis.com/css2?family=${fn.replace(/ /g,"+")}`
			link.onload = () => {
				resolve(fn);
			}
			document.body.prepend(link);
		})))
};
export default Fonts;