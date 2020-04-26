const fs = require('fs');
const { toXML } = require('jstoxml');
const convert = require('xml-js');
const { default: PQueue } = require('p-queue');
const { toPanoramaPromise, groupByCategory, rename } = require('./getPanoramaInfo');
const { toKml, fromKml, xmlOptions } = require('./panoramasToXml');

const promiseQueue = new PQueue({ concurrency: 4 });

const customNamesFile = 'resources/names.json';
const sourceFile = 'resources/Wander_Favorites.json';
const outuptWebFile = 'resources/Wander_Favorites.kml';
const outputLocalFile = 'resources/Wander_Favorites_LOCAL.kml';
const outputLocalNewFile = 'resources/Wander_Favorites_LOCAL_NEW.kml';

(async () => {

    console.log("-- Reading files --");
    const customNamesJson = fs.readFileSync(customNamesFile, 'utf8');
    const favoritesJson = fs.readFileSync(sourceFile, 'utf8');
    const favoritesKml = fs.existsSync(outuptWebFile) ?
        fs.readFileSync(outuptWebFile, 'utf8')
        : "";
    
    console.log("-- Parsing files --");
    const customNames = JSON.parse(customNamesJson);
    const favorites = JSON.parse(favoritesJson);
    const currentFavorites = JSON.parse(convert.xml2json(favoritesKml, { compact: true }));
    
    console.log("-- Processing data --");
    const currentPanos = fromKml(currentFavorites);
    const panoPromises = favorites.flatMap(({ folderContents, title }) => 
        folderContents.map(p => {
            p.category = title;
            return p;
        })
    ).map(toPanoramaPromise(currentPanos))

    console.log("-- Fetching results --");
    const panos = await promiseQueue.addAll(panoPromises)
        .then(res => res.filter(Boolean).map(rename(customNames)));
    
    console.log("-- Processing results --");
    const allCategories = panos.reduce(groupByCategory, {});
    const newCategories = panos.filter(p => !p.isStored).reduce(groupByCategory, {});
    
    console.log("-- Saving results --");
    fs.writeFileSync(outuptWebFile, toXML(toKml(allCategories), xmlOptions), "UTF-8");
    fs.writeFileSync(outputLocalFile, toXML(toKml(allCategories, true), xmlOptions), "UTF-8");
    fs.writeFileSync(outputLocalNewFile, toXML(toKml(newCategories), xmlOptions), "UTF-8");

    console.log("-- DONE --");
    
})();
