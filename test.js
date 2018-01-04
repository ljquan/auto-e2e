const Nightmare = require('.');


let nightmare = new Nightmare({
    show: true,
    openDevTools: {
        mode: 'detach'
    },
});

nightmare.goto('https://www.npmjs.com/package/deep-defaults')
         .then(console.log)
         .catch(console.error)