/*
 * Copyright 2016 Searsia
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * Searsia Client v0.4.0 spaghetti code:
 *   The web page should call getResources(params) 
 *   (using parameters from: searsiaUrlParameters())
 *   see: search.html
 *   Syntax checked with: jslint --eqeq --regexp --todo searsia.js
 */

/*global $, window, document, alert, jQuery, localStorage, Bloodhound*/

"use strict";

//var API_TEMPLATE = 'https://search.utwente.nl/searsia/search?q={q?}&r={r?}';
var API_TEMPLATE = 'http://localhost:16842/searsia/search?q={q?}&r={r?}';
// var API_TEMPLATE = 'http://hifitz.com:1200/searsia/search?q={q?}&r={r?}';


var AGG       = 1;   // 1=Aggregate results, 0=only boring links
var pending   = 0;   // Number of search engines that are answering a query
var nrResults = 0;   // Total number of results returned 
var page      = 1;   // search result page
var lang      = document.getElementsByTagName('html')[0].getAttribute('lang');    // used for language-dependent texts
var dataArray=[];
var topicsArray=[];
// variables for logging click-through data:
// the url to log click data, undefined or 0 to disable click logging
// preferably this url is formatted like '/searsia/clicklogger.php'
// but 'http://localhost:3000/searsia/clicklogger.php is also possible
// IMPORTANT: if the former method is used, the url must be in the same
// domain as the index page to prevent cross site scripting problems!
var logClickDataUrl = 1;
var sendSessionIdentifier = 1; // send anonymous session id with each click

// Enables suggestions, if they are provided via the API template's server.
var suggestionsOn = 1;

var searsiaStore = {

    hits: [],
    length: 0,
    query: '',
    ranking: [],

    push: function (hit) {
        var i = this.length;
        this.hits.push(hit);
        this.length += 1;
        while (i > 0 && hit.score > this.hits[i - 1].score) { // Order by score
            this.hits[i] = this.hits[i - 1];
            this.hits[i - 1] = hit;
            i -= 1;
        }
    },

    addHits: function (hits, start, end) {
        var i;
        for (i = start; i <= end; i += 1) {
            this.hits.push(hits[i]);
        }
        this.length += end - start;
    },

    shift: function () {
        var hit = this.hits.shift();
        this.length -= 1;
        return hit;
    },

    setQuery: function (query) {
        this.query = query;
    },

    getQuery: function () {
        return this.query;
    },

    addToRanking: function (resourceId, rank) {
        this.ranking[rank - 1] = resourceId;
    },

    removeFromRanking: function (rank) {
        this.ranking[rank - 1] = "";
    },

    getRanking: function (rank) {
        if (rank > 0 && rank < this.ranking.length) {
            return this.ranking.splice(0, rank);
        }
        return this.ranking;
    }

};


function fromMetaStore(field, value) {
    if (value != null) {
        try {
            window.localStorage['searsia-' + field] = value;
        } catch (ignore) { }
    } else {
        try {
            value = window.localStorage['searsia-' + field];
        } catch (ignore) { }
    }
    return value;
}


function supportsHtml5Storage() {
    try {
        return window.hasOwnProperty('localStorage') && window.localStorage !== null;
    } catch (e) {
        return false;
    }
}


function localSetResource(resource) {
    var id = fromMetaStore('id', null);
    if (id != null) {
        try {
            window.localStorage[id + '/' + resource.id] = JSON.stringify(resource);
        } catch (ignore) { }
    }
}


function localGetResource(rid) {
    var id = fromMetaStore('id', null);
    if (id == null) {
        return null;
    }
    try {
        return JSON.parse(window.localStorage[id + '/' + rid]);
    } catch (e) {
        return null;
    }
}


function localExistsResource(rid) {
    var id = fromMetaStore('id', null);
    if (id == null) {
        return false;
    }
    try {
        return window.localStorage.hasOwnProperty(id + '/' + rid);
    } catch (e) {
        return false;
    }
}


function localDeleteResource(rid) {
    var id = fromMetaStore('id', null);
    if (id != null) {
        try {
            delete window.localStorage[id + '/' + rid];
        } catch (ignore) { }
    }
}


function localAllResoureIds() {
    var i,
        key,
        list = [],
        id = fromMetaStore('id', null);
    if (id == null) {
        return [];
    }
    try {
        for (i = 0; i < localStorage.length; i += 1) {
            key  = window.localStorage.key(i);
            if (key.indexOf(id) === 0) {
                key = key.substr(id.length + 1, key.length - id.length - 1);
                list.push(key);
            }
        }
        return list;
    } catch (e) {
        return [];
    }
}


function getSuggestions(data) {
    var response = data[1];
    if (response.length > 7) { response = response.slice(0, 7); } // work around results 'limit' option
    return response;
}


function initSuggestion(suggesttemplate) {
    var typeAhead;
    if (suggestionsOn && typeof Bloodhound !== 'undefined') {
        typeAhead = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.whitespace,
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: {
                url: suggesttemplate,
                wildcard: '{q}',
                rateLimitWait: 200,
                rateLimitBy: 'debounce',
                cache: true,
                filter: getSuggestions
            }
        });
        $("#searsia-input").typeahead(
            {minLength: 1, highlight: true, hint: false},
            {name: 'searsia-autocomplete', source: typeAhead, limit: 20 }
        ).on(
            'typeahead:selected',
            function (e) { e.target.form.submit(); }
        );
    }
}

function storeMother(data) {
    if (data.resource != null && data.resource.id != null) {
        fromMetaStore('id', data.resource.id);
        data.resource.type = 'mother';
        localSetResource(data.resource);
    }
}


function placeBanner(data) {
    var banner = null;
    if (data.resource != null) {
        banner = data.resource.banner;
    }
    //banner = fromMetaStore('banner', banner);
	banner='./images/nottingham.jpg'
    if (banner != null && $('#searsia-banner').length) {
        $('#searsia-banner').html('<img src="' + banner + '" alt="" />');
        $("#searsia-banner").fadeIn();
    }
}


function placeName(data) {
    var name = null;
    if (data.resource != null) {
        name = data.resource.name;
    }
    //name = fromMetaStore('name', name);
    name = "方征的search engine";
    if (name != null) {
        $('head title').html(name + ' - Search');
    }
}


function placeIcon(data) {
    var icon = null;
    if (data.resource != null) {
        icon = data.resource.favicon;
    }
   // icon = fromMetaStore('icon', icon);
	icon = './images/icon.jpg';
    if (icon != null) {
        $('#favicon').attr('href', icon);
        $('div.searsia-icon img').attr('src', icon);
    }
}


function placeSuggestions(data) {
    var suggesttemplate = null;
    if (data.resource != null) {
        suggesttemplate = data.resource.suggesttemplate;
    }
    suggesttemplate = fromMetaStore('suggesttemplate', suggesttemplate);
    if (suggesttemplate != null) {
        initSuggestion(suggesttemplate);
    }
}


function getHost(url) {
    var match = url.match(/:\/\/(www\.)?(.[^\/:]+)/);
    if (match == null) {
        return null;
    }
    return match[2];
}


function searsiaUrlParameters() {
    var i, values,
        params = { q: "", r: "" },
        paramString = window.location.search.substring(1),
        parts = paramString.split("&");
    for (i = 0; i < parts.length; i += 1) {
        values = parts[i].split("=");
        if (values[0] === 'q') {
            params.q = values[1];
            params.q = params.q.replace(/%3C.*?%3E/g, '');
            params.q = params.q.replace(/%3C|%3E/g, '');
            params.q = params.q.replace(/^\++|\++$/g, ''); // no leading and trailing spaces 
        } else if (values[0] === 'r') {
            params.r = values[1];
        }
    }
    return params;
}


function searsiaError(text) {
    $('#searsia-alert-bottom').html(text);
}


function noHTMLattribute(text) {
    text = text.replace(/&/g, '&amp;');
    text = text.replace(/\"/g, '&#34;');
    return text;
}


function noHTMLelement(text) {
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');
    text = text.replace(/&/g, '&amp;');
    return text;
}


function printableQuery(query) {
    query = query.replace(/\+/g, ' ');
    query = decodeURIComponent(query);
    return noHTMLelement(query);
}


function formQuery(query) {
    query = printableQuery(query);
    query = query.replace(/&amp;/g, '&');
    return query;
}


function encodedQuery(text) {
    text = encodeURIComponent(text);
    text = text.replace(/%20/g, '+');
    return text;
}


function fillForm(query) {
    $('#searsia-form').find('input').attr('value', formQuery(query));
}


function fillUrlTemplate(template, query, resource) {
    template = template.replace(/\{q\??\}/g, query);
    template = template.replace(/\{r\??\}/g, resource);
    return template.replace(/\{[A-Za-z]+\?\}/g, '');  // remove all optional
}


function restrict(someText, size) { // size must be > 3
    if (someText != null && someText.length > size) {
        someText = someText.substr(0, size - 3) + '...';
    }
    return someText;
}


function highlightTerms(someText, query) {
    var i, re, terms, max;
    query = query.toLowerCase().replace(/[^0-9a-z]/g, '+');
    terms = query.split(/\++/); // This might not work for all character encodings
    max = terms.length;
    if (max > 10) { max = 10; }
    for (i = 0; i < max; i += 1) {
        if (terms[i].length > 0 && terms[i] !== 'b') { // do not match '<b>' again
            if (terms[i].length < 3) {
                terms[i] = '\\b' + terms[i] + '\\b';
            }
            try {
                re = new RegExp('(' + terms[i] + ')', "gi");
                someText = someText.replace(re, '<b>$1</b>');
            } catch (ignore) { }
        }
    }
    return someText;
}


function normalizeText(text) {
    return text.toLowerCase().replace(new RegExp('[^a-z0-9]', 'g'), ' ');
}


function scoreText(text, query) {
    var i, j, len,
        queryTerms,
        textTerms,
        score = 0.0;
    query = normalizeText(printableQuery(query));
    queryTerms = query.split(/ +/); // TODO: This might not work for all character encodings
    textTerms = normalizeText(text).split(/ +/);
    for (i = 0; i < queryTerms.length; i += 1) { // TODO: Really? Nested loop??
        len = textTerms.length;
        if (len > 45) { len = 45; } // Only check first 45 words
        for (j = 0; j < len; j += 1) {
            if (queryTerms[i] === textTerms[j]) {
                score += 1.0;
                break; // one occurrence per query term
            }
        }
    }
    return score;
}


function scoreHit(hit, i, query) {
    var score = 0,
        text;
    if (hit.description != null) {
        text = hit.title + ' ' + hit.description;
    } else {
        text = hit.title;
    }
    if (text != null) {
        score = scoreText(text, query);
    }
    return score - (i / 10);
}


/**
 * creates the onclick function for click log data, which can be inserted
 * in the html of href elements. This does not create an onclick element
 * if logClickDataUrl is not specified in the global parameters
 * @param rank
 * @param kind
 * @returns {*}
 */
function createOnClickElementforClickThrough(rank, kind) {
    if (logClickDataUrl) {
        return ' onclick="logClick(this, \'' + rank + '\', \'' + kind + '\')" ';
    }
    return '';
}


function htmlFullResult(query, hit, rank) {
    var result = '',
        title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image;
    title = restrict(title, 80);
    result += '<h4><a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a>';
    if (hit.favicon != null) {
        result += '<img src="' + hit.favicon + '" alt="">';
    }
    result += '</h4>';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
            + 'href="' + url + '"><img src="' + image + '" /></a>';
    }
    result += '<p>';
    if (descr == null) { descr = hit.title; }
    if (descr != null) {
        result += highlightTerms(restrict(descr, 200), query);
    } else {
        result += '&#151;';
    }
    result += '<br><a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
        + 'href="' + url + '">' + highlightTerms(restrict(url, 90), query) + '</a></p>';
    return result;
}

/**
 * Returns suggestions like 'related searches' and 'did you mean'
 * @param resource
 * @param hit
 * @param rank
 * @returns {string}
 */
function htmlSuggestionResult(resource, hit, rank) {
    var result = '',
        title  = hit.title,
        url    = hit.url;
    title = restrict(title, 80);
    result += '<h4>' + resource.name;
    result += ' <a ' + createOnClickElementforClickThrough(rank, 'suggested_result')
        + 'href="' + url + '"><b>' + title + '</b></a></h4>';
    return result;
}


function moreResultsText() {
    var result = "More results &gt;&gt;";
    if (lang === "nl") {
        result = "Meer resultaten &gt;&gt;";
    } else if (lang === "de") {
        result =  "Mehr Ergebnisse &gt;&gt;";
    } else if (lang === "fr") {
        result = "Plus de résultats &gt;&gt;";
    }
    return result;
}


function noMoreResultsText() {
    var result = "No more results.";
    if (lang === "nl") {
        result = "Geen andere resultaten.";
    } else if (lang === "de") {
        result =  "Keine Ergebnisse mehr.";
    } else if (lang === "fr") {
        result = "Pas plus de résultats.";
    }
    return result;
}


function noResultsText() {
    var result = "No results.";
    if (lang === "nl") {
        result = "Geen resultaten.";
    } else if (lang === "de") {
        result =  "Keine Ergebnisse.";
    } else if (lang === "fr") {
        result = "Pas de résultats.";
    }
    return result;
}


function moreResults(event) {
    var i, hit, maxi, query,
        result = '';
    event.preventDefault();
    maxi = searsiaStore.length;
    query = searsiaStore.getQuery();
    if (maxi > 8) { maxi = 8; }
    for (i = 0; i < maxi; i += 1) {
        hit = searsiaStore.shift();
        result += '<div class="search-result">';
        //TODO add ranking for this result (?)
        result += htmlFullResult(query, hit, -1);
        result += '</div>';
    }
    $('#searsia-results-4').append(result); // there are three divs for results, 1=top, 2=subtop, 3=rest, 4=more
    if (searsiaStore.length <= 0) {
        $('#searsia-alert-bottom').html(noMoreResultsText());
    }
}


function checkEmpty() {
    if (nrResults === 0) {
        $('#searsia-alert-bottom').html(noResultsText());
    } else if (searsiaStore.length <= 0) {
        $('#searsia-alert-bottom').html(noMoreResultsText());
    } else {
        $('#searsia-alert-bottom').html('<a href="#more" id="more-results">' + moreResultsText() + '</a>');
        $('#more-results').on('click', function (event) { moreResults(event); });
    }
}


function resultsError(rid, err) {
    var r;
    console.log('WARNING: ' + rid + ' (' + err + ')');
    //pending -= 1; // global 
    if (pending <= 0) {
        checkEmpty();
    }
    r = localGetResource(rid);
    if (r != null) {
        r.error = err;
        localSetResource(r);
    }
}


function correctUrl(absUrl, relUrl) {
    if (relUrl.match(/^https?:\/\//) || relUrl.match(/^\/\//)) {
        return relUrl;
    }
    if (absUrl == null) {
        return null;
    }
    if (relUrl.match(/^\//)) {
        return absUrl.replace(/([a-z])\/.*$/, '$1') + relUrl;
    }
    return absUrl.replace(/\/[^\/]+$/, '/') + relUrl;
}


/* 
 * This function is a mutable data type brain cracker:
 * That is we purposely change the values of data and
 * resource here...
 */
function inferMissingData(data, query) {
    var i, hit, resource, rhost,
        typeImages = true,
        typeSmall = true,
        typeFull = false,
        count = data.hits.length - 1;

    resource = data.resource;
    if (resource.urltemplate != null) {
        rhost = getHost(resource.urltemplate);
        if (resource.favicon == null) {
            resource.favicon = correctUrl(resource.urltemplate, '/favicon.ico');
        }
    }
    for (i = count; i >= 0; i -= 1) {
        hit = data.hits[i];
        if (hit.title == null) {  // everything *must* have a title
            hit.title = 'title';
            console.log("Warning: result without title");
        } else {
            hit.title = noHTMLelement(hit.title);
        }
        hit.score = scoreHit(hit, i, query);
        if (hit.url == null) {
            if (resource.urltemplate != null) {
                hit.url = fillUrlTemplate(resource.urltemplate, encodedQuery(hit.title), '');
            } else {
                hit.url = fillUrlTemplate('?q={q}', encodedQuery(hit.title), '');
            }
        } else {
            hit.url = correctUrl(resource.urltemplate, hit.url); //TODO: what if urltemplate is null?
            if (rhost == null || rhost !== getHost(hit.url)) {
                typeFull = true;
            }
            hit.url = noHTMLelement(hit.url);
        }
        if (hit.description != null) {
            hit.description = noHTMLelement(hit.description);
        }
        if (hit.image != null) {
            hit.image = noHTMLattribute(correctUrl(resource.urltemplate, hit.image));
        }
        if (hit.favicon == null && resource.favicon != null) {
            hit.favicon = resource.favicon;
        }
        if (hit.favicon != null) {
            hit.favicon = noHTMLattribute(hit.favicon);
        }
        if (hit.tags == null || hit.tags.indexOf('small') === -1) {
            typeSmall = false;
        }
        if (hit.tags == null || hit.tags.indexOf('image') === -1) {
            typeImages = false;
        }
		if (hit.rid == null ) {
           hit.rid=resource.id;
        }
        if (i < count && data.hits[i + 1].score > hit.score) {
            data.hits[i] = data.hits[i + 1]; // bubbling the best scoring hit up
            data.hits[i + 1] = hit;
        }
    }
    if (typeSmall) {
        resource.type = 'small';
    } else if (typeImages) {
        resource.type = 'images';
    } else if (typeFull) {
        resource.type = 'full';
    } else {
        resource.type = 'web';
    }
}


/*
 * Updates data.hits, removing hits that have a 
 * foundBefore date that is more than 2 weeks ago.
 */
function removeTooOldResults(data) {
    var i, hit,
        newHits = [],
        count = data.hits.length;
    if (count > 15) { count = 15; }
    for (i = 0; i < count; i += 1) {
        hit = data.hits[i];
        if (hit.foundBefore == null || Date.now() - new Date(hit.foundBefore).getTime() < 1209600000) { // 1209600000 is two weeks in miliseconds
            newHits.push(hit);
        }
    }
    data.hits = newHits;
}

/*
 * Returns html sub result, properly length-restricted
 * max length 220 characters, restricting the size of the
 * title and description. Title at least 80 characters.
 */
function htmlSubResultWeb(query, hit, rank) {
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image,
        result = '',
        tLength = 0,
        dLength = 0;
    tLength = title.length;
    if (descr != null) {
        dLength = descr.length;
    }
    if (tLength + dLength > 220) {
        tLength = 220 - dLength;
        if (tLength < 80) { tLength = 80; }
        title = restrict(title, tLength);
        tLength = title.length;
    }
    if (tLength + dLength > 220) {
        dLength = 220 - tLength;
    }
    result += '<div class="sub-result">';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web')
            + 'href="' + url + '"><img src="' + image + '"/></a>';
    }
    result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (tLength < 40 && dLength < 40) {
        result += '<br>';
    }
    if (descr != null) {
        result += highlightTerms(restrict(descr, dLength), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultWebFull(query, hit, rank) { // duplicate code with htmlSubResultWeb()
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image,
        maxsnip = 220,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result">';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
            + 'href="' + url + '"><img src="' + image + '"/></a>';
    }

    result += '<div class="descr"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
	if (hit.favicon != null) {
		result += ' <img src="' + hit.favicon + '" alt="" style="float: initial; height:1em; width:1em; margin:0; border: hidden;"> ';
    }
    if (descr != null) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</div>';
    if (url != null) {
        result += '<div class="url"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
            + 'href="' + url + '">' + highlightTerms(url, query) + '</a></div>';
    }
    result += '</div>';
    return result;
}


function htmlSubResultSmall(query, hit, rank) {
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        maxsnip = 120,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result-small">';
    result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_small')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null && maxsnip > 40) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultImage(hit, rank) {
    var title  = hit.title,
        url    = hit.url,
        image  = hit.image,
        result = '';
    title = restrict(title, 80);
    result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_image')
        + 'href="' + url + '"><img class="sub-image" src="' + image + '" alt="[image]" title="' + title + '"/></a>\n';
    return result;
}


function addToStore(data, begin, end) {
    var i, hits, resource;
    hits = data.hits;
    resource = data.resource;
    for (i = begin; i < end; i += 1) {
        if (hits[i].description == null) {
            if (resource.summary != null) {
                hits[i].description = resource.summary;
            } else {
                hits[i].description = resource.name;
            }
        }
        searsiaStore.push(hits[i]); // global store
    }
}


function htmlSubResults(query, data, rank) {
    var i, maxr,
        MAXX = 4,
        result = '<div>',
        count = data.hits.length,
        resource = data.resource;
    if (resource.type === 'images') {
        MAXX = 7;
    }
    if (count > MAXX) { count = MAXX; }
    for (i = 0; i < count; i += 1) {
        if (resource.type === 'small') {
            result += htmlSubResultSmall(query, data.hits[i], rank);
        } else if (resource.type === 'images') {
            result += htmlSubResultImage(data.hits[i], rank);
        } else if (resource.type === 'full') {
            result += htmlSubResultWebFull(query, data.hits[i], rank);
        } else {
            result += htmlSubResultWeb(query, data.hits[i], rank);
        }
    }
    result += '</div>';
    maxr = data.hits.length;
    if (maxr > 15) { maxr = 15; } // no more than 15 per resource
    addToStore(data, count, maxr);
    return result;
}


function htmlResource(query, resource, printQuery, rank) {
    var url, title,
        result = '<h4>';
    if (resource.urltemplate != null) {
        title = resource.name;
        if (printQuery && resource.urltemplate.indexOf('{q}') > -1) {
            title += ' - ' + printableQuery(query);
            url = fillUrlTemplate(resource.urltemplate, query, '');
        } else {
            url = fillUrlTemplate(resource.urltemplate, '', '');
        }
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header')
            + 'href="' + url + '">';
        title = restrict(title, 80);
        result += highlightTerms(title, query) + '</a>';
        if (resource.favicon != null) {
            result += '<img src="' + resource.favicon + '" alt="">';
        }
    } else {
        console.log("Warning, no template: " + resource.name);
        result += highlightTerms(resource.name, query);
    }
    result += '</h4><p>';
    if (resource.summary != null) {
        result += highlightTerms(restrict(resource.summary, 90), query) + '<br>';
    }
    if (url != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header')
            + 'href="' + url + '">' + highlightTerms(restrict(url, 90), query) + '</a>';
    }
    result += '</p>';
    return result;
}


function printSingleResult(query, hit, rank) {
    var result, where = rank;
    result = '<div class="search-result">';
    result += htmlFullResult(query, hit, rank);
    result += '</div>';
    if (where < 1) { where = 1; }
    if (where > 4) { where = 4; }
    $('#searsia-results-' + where).append(result);
}


function printAggregatedResults(query, data, rank, printQuery) {
    var result = '',
        count = data.hits.length,
        resource = data.resource;
    if (count > 0) {
        result += '<div class="search-result">';
        if (count === 1) {
            if (data.hits[0].tags != null && data.hits[0].tags.indexOf('suggestion') !== -1) {
                result += htmlSuggestionResult(resource, data.hits[0], rank);
            } else {
                result += htmlFullResult(query, data.hits[0], rank);
            }
        } else {
            result += htmlResource(query, resource, printQuery, rank);
            result += htmlSubResults(query, data, rank);
        }
        result += '</div>';
        if (rank < 1) { rank = 1; }
        if (rank > 4) { rank = 4; }
        $('#searsia-results-' + rank).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    } else {
        //Remove this resource from the ranking because it is not shown to the user
        searsiaStore.removeFromRanking(rank);
    }
}


function printNormalResults(query, data, rank) {
    var result, i, where,
        MAXX = 4,
        count = data.hits.length;
    if (count > MAXX) { count = MAXX; }
    for (i = 0; i < count; i += 1) {
        result = '<div class="search-result">';
        result += htmlFullResult(query, data.hits[i], rank);
        result += '</div>';
        where = rank + i;
        if (where < 1) { where = 1; }
        if (where > 4) { where = 4; }
        $('#searsia-results-' + where).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    }
    return count;
}


function printResults(query, data, rank, olddata) {
    var nrDisplayed,
        count = data.hits.length; // TODO: also includes 'rid'-only results from searsia engines
    if (data.resource != null && data.resource.apitemplate != null) {
        localSetResource(data.resource);
    }

    if (count > 0) {
        inferMissingData(data, query);
        $('#searsia-alert-bottom').html('');
        if (count > 15) { count = 15; } // no more than 15 per resource
        nrResults += count; // global
        if (AGG === 0 || data.resource.name == null) {
            nrDisplayed = printNormalResults(query, data, rank);
            addToStore(data, nrDisplayed, count);
        } else {
            printAggregatedResults(query, data, rank, true); // TODO: addToStore now happens deep inside printAggregatedResults...
        }
    } else {
        inferMissingData(olddata, query);
        removeTooOldResults(olddata);
        printAggregatedResults(query, olddata, rank, false);
    }
    pending -= 1; // global
    if (pending <= 0) {
        checkEmpty();
    }
}


function getResults(query, rid, rank, olddata) {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, query, rid),
        success: function (data) { printResults(query, data, rank, olddata); },
        error: function (xhr, options, err) {
            printResults(query, olddata, rank, olddata);
            resultsError(rid, err);
        },
        timout: 12000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}

function getFedretedResults(query, rid, rank, olddata) {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, query, rid),
        success: function (data) { printFedratedResults(query, data, rank, olddata); },
        error: function (xhr, options, err) {
            printFedratedResults(query, olddata, rank, olddata);
            resultsError(rid, err);
        },
        timout: 500,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}


function queryResources(query, data) {
    var rid, hits, olddata,
        oldquery = "",
        i = 0,
        rank = 1,
        done = [];
    storeMother(data);
    placeIcon(data);
    searsiaStore.setQuery(query);
    hits = data.hits;
    while (i < hits.length) {
        rid = hits[i].rid;
        searsiaStore.addToRanking(rid, rank); // store the ranking of this resource
        if (rid == null) { // a result that is not from another resource
            if (data.resource == null || data.resource.rerank == null || scoreHit(hits[i], 0, query) > 0.0) { // TODO: real reranking
                printSingleResult(query, hits[i], rank);
                nrResults += 1; // global
                rank += 1;
            }
        } else if (done[rid] !== 1 && pending<10) {
            //oldquery = hits[i].query; // remove comment to enable 'cached' result
            olddata = { hits: [] };
			if (localExistsResource(rid)) {
                olddata.resource = localGetResource(rid);
                while (i < hits.length && hits[i].rid === rid) {
                    if (hits[i].title != null && hits[i].title != "" && // too many exceptions?
                            (hits[i].url != null || olddata.resource.urltemplate != null)) {
                        olddata.hits.push(hits[i]);
                    }
                    i += 1;
                }
                i -= 1;  // otherwise we miss one
            } 
			/* if (localExistsResource(rid)) {
					var n=0;
					olddata.resource = localGetResource(rid);
					while (n < hits.length  /* && hits[n].rid === rid    ) {
						if (hits[n].title != null && hits[n].title != "" && // too many exceptions?
								(hits[n].url != null || olddata.resource.urltemplate != null) && hits[n].rid === rid) {
							olddata.hits.push(hits[n]);
						}
						n += 1;
					}
					//i -= 1;  // otherwise we miss one
				} */
			else {
                olddata.resource = { id: rid }; // TODO: get it?
            }
            if (oldquery === query && localExistsResource(rid) && olddata.hits.length > 0) {  // a 'cached' result.
                printResults(query, olddata, rank, olddata);
            } else {                         // some result, but not the best
                //getResults(query, rid, rank, olddata);
				getFedretedResults(query, rid, rank, olddata);
                pending += 1; // global
            }
            done[rid] = 1;
            rank += 1;
        }
        i += 1;
    }
    if (pending < 1) {
        checkEmpty();
    }
    placeSuggestions(data);
}


function getResources(params) {
    /*jslint unparam: true*/
    if (params.q.length > 150) {
        searsiaError('Query too long.');
        return;
    }
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, params.q, ''),
        success: function (data) { queryResources(params.q, data); },
        error: function (xhr, options, error) { searsiaError('Temporarily out of order. Please try again later.'); },
        timeout: 10000,
        dataType: 'json'
    });
    $('#searsia-alert-bottom').html('<img src="images/progress.gif" alt="searching...">');
    /*jslint unparam: false*/
}


function getResourceInfo(rid) {
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, '', rid),
        timeout: 10000,
        dataType: 'json'
    }).done(function (data) {
        localSetResource(data.resource);
    });
}


// get the 15 most important resources
function storeResources(data) {
    var rid,
        i = 0,
        j = 0,
        hits = data.hits;
    if (hits != null) {
        while (i < hits.length && j < 15) {
            rid = hits[i].rid;
            if (rid != null && !localExistsResource(rid)) {
                getResourceInfo(rid);
                j += 1;
            }
            i += 1;
        }
    }
}


function initSearsiaClient(data) {
    storeMother(data);
    placeBanner(data);
    placeIcon(data);
    placeName(data);
    placeSuggestions(data);
    storeResources(data);
    $("#searsia-input").focus();
}


/**
 * set cookie value
 * @param cname name of the cookie
 * @param cvalue value of the cookie
 * @param exdays days before the cookie expires
 */
function setCookie(cname, cvalue, exdays) {
    var d = new Date(),
        expires;
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}


/**
 * get a cookie value
 * @param cname the name of the cookie
 * @returns {*}
 */
function getCookie(cname) {
    var name = cname + "=",
        ca = document.cookie.split(';'),
        i,
        c;
    for (i = 0; i < ca.length; i += 1) {
        c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}


/*jslint bitwise: true*/

/**
 * Generates a random identifier compliant with the uuid(v4) spec.
 * The randomness of this number is based on Math.random(), which might not
 * be a guaranteed RNG.
 * @returns {string} the uuid string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
        function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}
/*jslint bitwise: false*/


/**
 * Returns an anonymous identifier for the user session, creates a session
 * if a session does not exist This session identifier is generated and
 * stored client-side. This is nog a server-side session.
 */
function getOrSetSessionIdentifier() {
    var sessionId = getCookie('sessionId');
    if (!sessionId) {
        sessionId = generateUUID();
        setCookie('sessionId', sessionId, 1);
    }
    return sessionId;
}


/**
 * converts a standard url to a url suitable for clicklogging
 * Does not convert if click through data is disabled
 * This can be done by replacing the contents of the logClickDataUrl
 * variable with 0 or undefined
 */
function convertUrlForClickThroughData(url, rank, kind) {
    if (logClickDataUrl) {
        //replace &amp; with normal & for encoding the uri component
        url = url.replace(/&amp;/g, "&");
        url = encodeURIComponent(url);
        url = logClickDataUrl + '?url=' + url;

        url += '&query=' + searsiaStore.getQuery();

        if (rank) {
            url += '&rank=' + rank;
        }
        if (kind) {
            url += '&kind=' + kind;
        }
        if (sendSessionIdentifier) {
            url += '&sessionId=' + getOrSetSessionIdentifier();
        }
        url += '&ordering=' + searsiaStore.getRanking(rank).toString();
    }
    return url;
}


/**
 * This function is used although editors might show it as unused, this
 * function is only called from generated html. This functions logs the
 * click data and continues normal forwarding operations for the user.
 * @param element the element that is clicked on
 * @param rank the rank of the clicked element
 * @param kind the kind of link that is clicked on
 */
function logClick(element, rank, kind) {
    if (logClickDataUrl) {
        //TODO make post call
        $.ajax({
            type: "GET",
            url: convertUrlForClickThroughData($(element).attr('href'), rank, kind),
        }); 
    }
}


function connectToServer() {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, '', ''),
        success: function (data) { initSearsiaClient(data); },
        error: function (xhr, options, error) { searsiaError('Cannot connect to search server.'); },
        timeout: 10000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}

function printFedratedResults(query, data, rank, olddata) {
    var i=0,n_grams,
		topicCandidates=[];
    if (data.resource != null && data.resource.apitemplate != null) {
        localSetResource(data.resource);
    }
	inferMissingData(data, query);
	pre_processing(data); // hits stemming  
	n_grams=n_gram_mining(data); // up to 4_gram mining
	
	nrResults+=data.hits.length;
	data.hits.map(function(e){searsiaStore.push(e)});
	
	dataArray.push(data);
	topicsArray.push(n_grams);

    pending -= 1; // global
    if (pending <= 0) {
		var hits=reduceHits(dataArray); // combine hits from different sources
		var topics=reduceTopics(topicsArray,hits);// combine topics from different sources
		var idf=getArray_IDF(topics,hits);//get IDF for topics
		 
		topics=topics.filter(function(e){return e.termCount>=3 /*&& stopwordStem.indexOf(e.name)===-1  && e.docCount>=3 */});//remove noise phrases
		getRetrivalResults(topics,hits,idf,query);//composite retrival
        checkEmpty();  
    } 
}

function normalize(text){
	var	dateExpression=/^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]|(?:Jan|Mar|May|Jul|Aug|Oct|Dec)))\1|(?:(?:29|30)(\/|-|\.)(?:0?[1,3-9]|1[0-2]|(?:Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)(?:0?2|(?:Feb))\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9]|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep))|(?:1[0-2]|(?:Oct|Nov|Dec)))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/g,
		urlExpression=/(https|http)?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+.~#?&//=]*/g,
		//urlExpression=/(http|https)?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g,
		REallowedChars = /[^a-zA-Z0-9'\-]+/g;
	return text.toLowerCase().replace(dateExpression,' ').replace(urlExpression,' ').replace(/\B\W+/g,' ').replace(/\W+\B/g,' ').replace(/[0-9]*\/+[0-9]*\/+[0-9]*/g,' ').replace(/\bamp\b/g,' ').replace(REallowedChars,' ');
}

function structure(text){
	var	dateExpression=/^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]|(?:Jan|Mar|May|Jul|Aug|Oct|Dec)))\1|(?:(?:29|30)(\/|-|\.)(?:0?[1,3-9]|1[0-2]|(?:Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)(?:0?2|(?:Feb))\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9]|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep))|(?:1[0-2]|(?:Oct|Nov|Dec)))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/g,
		urlExpression=/(https|http)?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+.~#?&//=]*/g,
		//urlExpression=/(http|https)?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g,
		REallowedChars = /[^a-zA-Z0-9'\-\|\s]+/g;
	return text.toLowerCase().replace(dateExpression,' | ').replace(urlExpression,' | ').replace(/\B\W+/g,' | ').replace(/\W+\B/g,' | ').replace(/[0-9]*\/+[0-9]*\/+[0-9]*/g,' | ').replace(/\bamp\b/g,' ').replace(REallowedChars,' | ');
}

function toStem(text){
	var i=0,re,
		textArray=text.split(/\s+/),
		outputText='';
	if(text!=undefined){
		outputText=text;
		for(i=0;i<textArray.length;i++){
			if(textArray[i].match(/'/)===null && textArray[i].match(/-/)===null){
				re = new RegExp("\\b"+textArray[i]+"\\b");
				outputText=outputText.replace(re,stemmer(textArray[i]));
			}
		}
	}
	return outputText;
}

function unique(array){
	var n = []; 

	for(var i = 0; i < array.length; i++){
		if (n.indexOf(array[i]) == -1) n.push(array[i]);
	}
	return n;
}

function getGrams(text){
	var n=0,i=0,
		temGram=[],
		uniGram=[],
		biGram=[],
		triGram=[],
		fourGram=[],
		temArray=[],
		grams=[];
		
	uniGram=toStem(text).replace(/^\s+/,"").replace(/\s+$/,"").split(/\s+/);
	
	for (n = 0; n < uniGram.length; n++){
		if (n<uniGram.length-1){
			biGram[n]=uniGram[n]+' '+uniGram[n+1];
		}
	} 
	
	for (n = 0; n < uniGram.length; n += 1){
		if (n<uniGram.length-2){
			triGram[n]=uniGram[n]+' '+uniGram[n+1]+' '+uniGram[n+2];
		}
	} 

	for (n = 0; n < uniGram.length; n += 1){
		if (n<uniGram.length-3){
			fourGram[n]=uniGram[n]+' '+uniGram[n+1]+' '+uniGram[n+2]+' '+uniGram[n+3];
		}
	} 

	grams=uniGram.concat(biGram).concat(triGram).concat(fourGram);
	return grams;
}


function pre_processing(data){
	var i=0,
		count=data.hits.length,
		candidates=[],
		normalizedTitle='',
		normalizedDescription='';
	while(i<count){
		normalizedTitle='';
		normalizedDescription='';
		data.hits[i].sentences=[];
		if(data.hits[i].title!=undefined){
			normalizedTitle=normalize(data.hits[i].title);
			data.hits[i].titleStem=toStem(normalizedTitle);
			data.hits[i].sentences=data.hits[i].sentences.concat(structure(data.hits[i].title).split('|'));
		}
		if(data.hits[i].description!=undefined){
			normalizedDescription=normalize(data.hits[i].description);
			data.hits[i].descriptionStem=toStem(normalizedDescription);
			data.hits[i].sentences=data.hits[i].sentences.concat(structure(data.hits[i].description).split('|'));
		}
		else{
			data.hits[i].description=data.hits[i].title;
			data.hits[i].descriptionStem=data.hits[i].titleStem;
		}
		data.hits[i].stem=data.hits[i].titleStem+' '+data.hits[i].descriptionStem;
		i++;
	} 
}

function n_gram_mining(data){
	var i=0,n=0,
		n_gram=[],
		hits=data.hits,
		count=data.hits.length;
		
	 while(i<count){
		 hits[i].grams=[];
		for(n=0;n<hits[i].sentences.length;n++){
			hits[i].grams=hits[i].grams.concat(getGrams(hits[i].sentences[n]));
		}
		hits[i].grams=hits[i].grams.filter(function(e){return e!=[]});
		n_gram=n_gram.concat(hits[i].grams);
		i++;
	}	
		
	/* while(i<count){
		n_gram=n_gram.concat(getGrams(hits[i].titleStem)).concat(getGrams(hits[i].descriptionStem));
		i++;
	} */
	n_gram=unique(n_gram).filter(function(e){return e!=[]});
	return n_gram;
}


function sortName(a,b){
	if (a.name > b.name) {
		return 1;
	}
	if (a.name < b.name) {
		return -1;
	}
	return 0;
}

function reduceTopics(topicsArray,hits){
	var i=0,n=0,
		n_grams=[],
		flattened = [],
		topics=[],
		re,
		stems=[];
	
	flattened = topicsArray.reduce(
		function(a, b) { return a.concat(b)}
		,[]
	);
	n_grams=unique(flattened);
	
	stems = hits.map(function(e){return e.stem;}).reduce(
		function(a, b) { return b + ' ' + a;}
		,[]
	);

	i=0;
	while(i<n_grams.length){
		var terms=n_grams[i].split(/\s+/);
		var tempHits=hits;
		var temp={name:'',docCount:0,termCount:0,docs:[]};
		for(n=0;n<terms.length;n++){
			//re=new RegExp("\\b"+terms[n]+"\\b","g");
			tempHits=tempHits.filter(function(e){return e.grams.indexOf(terms[n])!=-1});
		} 
		//tempHits=tempHits.filter(function(e){return e.grams.indexOf(n_grams[i])!=-1});
		temp.name=n_grams[i];
		temp.docs=tempHits;
		temp.docCount=hits.filter(function(e){return e.grams.indexOf(n_grams[i])!=-1}).length;
		//temp.docCount=tempHits.length;
		//temp.termCount=termFrequency(n_grams[i],stems);
		temp.termCount=tempHits.reduce(function(a,b){return b.grams.filter(function(e){return e===n_grams[i]}).length+a},0);
		topics.push(temp);
		i++;
	}  
	return topics;
}

function reduceHits(dataArray){
	var i=0,
		hits=[];
	while(i<dataArray.length){
		hits=hits.concat(dataArray[i].hits);
		i++;
	} 
	return hits;
}

function getArray_IDF(topics,hits){
	var i=0,name,
		docCount,
		count=hits.length,
		idf={};
	
	while(i<topics.length){
		name=topics[i].name;
		docCount=topics[i].docCount;
		idf[name]=1+Math.log(count/docCount);	
		i++;
	}
	return idf;
}

function getRetrivalResults(topics,hits,idf,query){
	var	i=0,n=0,
		clusters,
		suggestion=[],
		query=normalize(query);
	clusters=subtopicMining(topics,hits,idf,query); //mining good topics
	clusters=clusters.filter(function(e){return e.topic.docCount/hits.length<0.3}); //filter topics cover too many documents
	clusters=bundleForming(clusters);// form bundles and remove similiar topics
	clusters=sortBundles(query,clusters);
	suggestion=clusters.slice(0,5).map(function(e){return e.name});
	clusters=clusters.filter(function(e){return e.docs.length>=5});//filter bundles whose documents number less than 5
	outputToWebRelevance(query,clusters);  //output to users    
	/* i=0;
	while(i<suggestion.length){
		var result = '';
		result += '<div class="search-result">';
		result += '<h3>'+suggestion[i]+'</h3>'; 
 		result += '<h3>'+'SCORE'+clusters[i].SCORE+'</h3>'; 
		result += '<h3>'+'TFIDF'+clusters[i].TFIDF+'</h3>'; 
		result += '<h3>'+'CE'+clusters[i].CE+'</h3>'; 
		result += '<h3>'+'IND'+clusters[i].IND+'</h3>'; 
		result += '<h3>'+'ICS'+clusters[i].ICS+'</h3>';     
		result += '</div>'; 
		var	rank=1;
		$('#searsia-results-'+ rank).append(result);
		i++;
	}       */
}

function subtopicMining(topics,hits,idf,query){
	var i=0,
		candidates=[];
		
	for(i=0;i<topics.length;i++){
		candidates.push({
			topic:	topics[i],
			TFIDF:	setTFIDF(topics[i],hits.length),
			LEN:	setLength(topics[i]),
			ICS:	setICS(topics[i],idf),
			CE:		setCE(topics[i],topics),
			IND:	setIND(topics[i]),
			score:	0
		});
	}

	candidates=noisefiltering(candidates,query);
	candidates=candidates.filter(function(e){return e.TFIDF>0 && e.IND>0 && e.CE>0 && e.ICS>0});
	var maxTFIDF=Math.max.apply(Math,candidates.map(function(e){return e.TFIDF}));
	var maxLength=Math.max.apply(Math,candidates.map(function(e){return e.LEN}));
	var maxICS=Math.max.apply(Math,candidates.map(function(e){return e.ICS}));
	var maxCE=Math.max.apply(Math,candidates.map(function(e){return e.CE}));
	var maxIND=Math.max.apply(Math,candidates.map(function(e){return e.IND}));
	candidates.map(function(e){ e.LEN=e.LEN/maxLength});
	candidates.map(function(e){ e.TFIDF=e.TFIDF/maxTFIDF});
	candidates.map(function(e){ e.ICS=e.ICS/maxICS});
	candidates.map(function(e){ e.CE=e.CE/maxCE});
	candidates.map(function(e){ e.IND=e.IND/maxIND});   
	setScore(candidates);
	candidates=sort(candidates).filter(function(e){return e.SCORE>1.2});
	//candidates=sort(candidates).filter(function(e){return e.TFIDF>0.2 && e.IND>0.1 && e.CE>0 && e.ICS>0});
	return candidates;
}

function setTFIDF(topic,hitslength){
	return topic.termCount*Math.log(hitslength/topic.docCount)
}

function setLength (topic) {
	var pharseArray=[];
	
	pharseArray = topic.name.split(/\s+/);	
	return pharseArray.length;		
}

function cosineSimilarity(vector,centroid){
	var i=0,
		temp=0,
		temp2=0,
		temp3=0,
		keys=Object.keys(vector);
		
	while(i<keys.length){
		temp+=centroid[keys[i]]*vector[keys[i]];
		i++;
	}
	
	temp2 = Object.values(vector).reduce(function (returnValue, term) { 
		return returnValue+=term*term;
	}, 0);
	temp3 = Object.values(centroid).reduce(function (returnValue, term) { 
		return returnValue+=term*term;
	}, 0);
	
	return temp/(Math.sqrt(temp2)*Math.sqrt(temp3));
}


function setICS(topic,idf){
	var hits=topic.docs,
		centroid,i=0,
		ICS=0,
		flattened = [];
	
	flattened = hits.map(function(e){return e.stem;}).reduce(
		function(a, b) { return b + ' ' + a;}
		,[]
	);
	var terms= unique(flattened.replace(/^\s+/,"").replace(/\s+$/,"").split(/\s+/));
	centroid = terms.reduce(function (allterms, term) { 
		allterms[term]=0;
		return allterms;
	}, {});
	
	while(i<hits.length){
		var vectorItems=hits[i].stem.replace(/^\s+/,"").replace(/\s+$/,"").split(/\s+/);
		hits[i].vector=vectorItems.reduce(function (allterms, term) { 
			if (term in allterms) {
				allterms[term] += 1/vectorItems.length*idf[term];
			}
			else {
				allterms[term] = 1/vectorItems.length*idf[term];
			}
				return allterms;
		}, {});
		Object.keys(hits[i].vector).map(function(e){centroid[e]+=hits[i].vector[e]/hits.length});
		i++;
	}
	
	
	i=0;
	while(i<hits.length){
		ICS+=cosineSimilarity(hits[i].vector,centroid);
		i++;
	}  
 
	return ICS=ICS/hits.length;
}

function setCE(topic,topics){
	var i=0,CE=0,
		hits=topic.docs;
	
	while(i<topics.length){
		var checkedhits=topics[i].docs;
		var overlap=(hits.concat(checkedhits).length-unique(hits.concat(checkedhits)).length)/hits.length;
		if(overlap===0){
			CE-=0;
		}else{
			CE-=overlap*Math.log(overlap);
		}
		i++;
	}
	
	return CE;
}

function main_IND(contentArray,topicname){
	var i=0,
		IND=0,
		contents=[];
		
	contents = contentArray.reduce(function (allterms, term) { 
			if (term in allterms) {
				allterms[term]++;
			}
			else {
				allterms[term] = 1;
			}
				return allterms;
		}, {});
	
	var keys=Object.keys(contents);
	while(i<keys.length){
		if(keys[i]===topicname){
			IND-=contents[keys[i]]*(1/contentArray.length*Math.log(1/contentArray.length));
		}
		else{
			IND-=contents[keys[i]]/contentArray.length*Math.log(contents[keys[i]]/contentArray.length);
		}
		i++;
	}
	return IND;
}

function setIND(topic){
	var	i=0,LIND,RIND,
		left_content=[],
		right_content=[],
		re_left=new RegExp("\[a-zA-Z0-9-'\]*\\s\+"+"\\b"+topic.name+"\\b"+"|"+"\\b"+topic.name+"\\b",'g'),
		re_right=new RegExp("\\b"+topic.name+"\\b"+"\\s\+\[a-zA-Z0-9-'\]*"+"|"+"\\b"+topic.name+"\\b",'g'),
		hits=topic.docs;

	while(i<hits.length){
		left_content=left_content.concat(hits[i].stem.match(re_left));
		right_content=right_content.concat(hits[i].stem.match(re_right));
		i++;
	}
	LIND=main_IND(left_content,topic.name);
	RIND=main_IND(right_content,topic.name);
	
	if(LIND===0 || RIND===0){
		return 0;
	} 
	return (LIND+RIND)/2;
}

function setScore(candidates){
	var i;
	for (i=0;i<candidates.length;i++){
		candidates[i].SCORE=1+0.146*candidates[i].TFIDF+0.241*candidates[i].LEN-0.022*candidates[i].ICS+0.065*candidates[i].CE+0.266*candidates[i].IND;
	}
}

function sort(input){
	var i=0,
		sortedHits=[];
	for (i=0;i<input.length;i++){
		sortedHits=sortedHits.concat(input[i]);
	}
	sortedHits.sort(function (a, b) {
	if (a.SCORE > b.SCORE) {
		return -1;
	}
	if (a.SCORE < b.SCORE) {
		return 1;
	}
	return 0;
	}); 
	return sortedHits;
}

function noisefiltering(candidates,query){
	var i=0,
		target,
		output=[],
		queryStem=toStem(normalize(query)),
		queryRE=new RegExp("\\b"+queryStem+"\\b","g");
	while(i<candidates.length){
		target=candidates[i];
		var stemCount=0;
		var name=target.topic.name.replace(queryRE," ").replace(/^\s+/,"").replace(/\s+$/,"").split(/\s+/);
		name.map(function(e){if(stopwordStem.indexOf(e)!=-1 || queryStem.indexOf(e)!=-1)  stemCount++});
		var temp=target.topic.name.split(/\s+/);

		if(stemCount!=name.length && target.topic.name!=queryStem && target.topic.name.match(/[A-Za-z]+/)!=null && stopwordStem.indexOf(temp[temp.length-1])===-1  && prepositionStem.indexOf(temp[0])===-1  && target.topic.name.length>2   ){
			if(temp[temp.length-1].indexOf("'")===-1)
				output.push(target);
		}
		i++;
	}
	return output;
}
//2-level merge duplicate bundles 
function diversifyCluster(clusters){
	var	i,n,overlapCount,
		currentCluster,
		checkedCluster;
	
	for(i=0;i<clusters.length;i++){
		currentCluster=clusters[i];
		if(currentCluster!=null){
			for(n=0;n<clusters.length;n++){
				checkedCluster=clusters[n];
				if(checkedCluster!=null){
					overlapCount=currentCluster.docs.concat(checkedCluster.docs).length-unique(currentCluster.docs.concat(checkedCluster.docs)).length;
					if(overlapCount/checkedCluster.docs.length>=0.75  && checkedCluster!=currentCluster){
						if(checkedCluster.docs.length>currentCluster.docs.length)
							delete clusters[i];
						else
							delete clusters[n];
					}
				}
			}
		}
	}
	clusters=clusters.filter(function(e){return e!=null});
	return clusters;
}
//1-level merge duplicate bundles 
function bundle_merge(bundles,threshold){
	var i=0,
		n=0,
		first_link=[],
		bundle_clusters=[],
		output=[];
	
	while(i<bundles.length){
		var tempArray=[];
		n=0;
		while(n<bundles.length){
			var overlapCount=bundles[i].topic.docs.concat(bundles[n].topic.docs).length-unique(bundles[i].topic.docs.concat(bundles[n].topic.docs)).length;
			if(overlapCount/bundles[i].topic.docs.length>=threshold && overlapCount/bundles[n].topic.docs.length>=threshold){
				tempArray.push(bundles[n]);
			}
			n++;
		}
		bundle_clusters.push(tempArray); 
		first_link[bundles[i].topic.name]=tempArray.length;
		i++;
	}
	
	i=0;
	while(i<bundle_clusters.length){
		if(bundle_clusters[i]!=null){
			var temp=bundle_clusters[i];
			var previouslength=0;
			while(previouslength!=temp.length){
				previouslength=temp.length;
				n=0;
				while(n<bundle_clusters.length){
					if(bundle_clusters[n]!=null){
						var overlapCount=temp.concat(bundle_clusters[n]).length-unique(temp.concat(bundle_clusters[n])).length;
						if(overlapCount>0){
							temp=unique(temp.concat(bundle_clusters[n]));
							bundle_clusters[n]=null;
						}
					}
					n++;
				}
			}
			output.push(temp);
		}
		i++;
	} 
	output=adjustTitle(output,first_link);
	output=diversifyCluster(output);
	return output;
}

function bundleForming(clusters){
	var i=0,
		n=0,
		bundles=clusters;
	
	bundles=bundle_merge(bundles,0.75);
	return bundles;
}

//choose the best name for merged bundle cluster
function adjustTitle(clusters,countArray){
	var i=0,n=0,
		bundles=[];
	
	while(i<clusters.length){
		var current=clusters[i][0];
		var linkCount=countArray[current.topic.name];
		for(n=0;n<clusters[i].length;n++){
			var tempcount=countArray[clusters[i][n].topic.name];
			if(tempcount>linkCount){
				current=clusters[i][n];
				linkCount=tempcount;
			}
			else if(tempcount===linkCount){
				//var score1=scoreDocsOnBM25(clusters[i][n].topic.name,clusters[i][n].topic.docs);
				//var score2=scoreDocsOnBM25(current.topic.name,current.topic.docs)
				//if(score1>score2){
				if(clusters[i][n].SCORE>current.SCORE){
					current=clusters[i][n];
					linkCount=tempcount;
				}
			}
		}
		var flattened = clusters[i].reduce(
			function(a, b) { return a.concat(b.topic.docs);}
			,[]
		);
		flattened=unique(flattened);
		bundles.push({name:current.topic.name,docs:flattened});
		//bundles.push({name:clusters[i].map(function(e){return e.topic.name}),docs:flattened});
		i++;
	}
	return bundles;
}
//each bundle should have two verticals
function enforceVertical(clusters){
	var i=0,n,
		rid,
		done=[],
		newhits=[],
		hits=[];
	while(i<clusters.length){
		hits=clusters[i].docs;
		newhits=[];
		done=[];
		for(n=0;n<hits.length;n++){
			rid=hits[n].rid;
			if(Object.keys(done).length<2 && newhits.length===6){
				newhits=newhits.slice(0,5);
			}
			if(newhits.length<6){
				if(done[rid]!=1){
					done[rid]=1;
				}
				newhits.push(hits[n]);
			}
		}
		clusters[i].docs=newhits;
		i++
	}
	return clusters;
}

//sort bundles based on thier relevance
function sortClusterRelevance(clusters,query){
	var i=0,n,
		querySimiliarity=0;
		
	while(i<clusters.length){
		querySimiliarity=scoreDocsOnBM25(query,clusters[i].docs)*scoreDocsOnBM25(clusters[i].name,clusters[i].docs);
		//querySimiliarity=scoreDocsOnBM25(clusters[i].name,clusters[i].docs)/clusters[i].name.split(/\s+/).length;
		clusters[i].SCORE=querySimiliarity;
		i++;
	}
	clusters=sort(clusters);
	return clusters;
}

function sortVerticalCluster(clusters){
	var i=0,n,
		rid,
		hits,
		keysSorted,
		vertical=[],
		outputVertical=[];
		
	while(i<clusters.length){
		vertical=[];
		outputVertical=[];
		hits=clusters[i].docs;
		n=0;
		while(n<hits.length){
			rid=hits[n].rid;
			if(vertical[rid]==null){
				vertical[rid]=[];
				vertical[rid].push(hits[n]);
			}
			else{
				vertical[rid].push(hits[n]);
			}
			n++
		}
		keysSorted = Object.keys(vertical).sort(function(a,b){return vertical[b].length-vertical[a].length})
		keysSorted.map(function(e){outputVertical.push(vertical[e])});
		clusters[i].verticalHits=outputVertical;
		i++;
	}
	return clusters;
}

function outputToWebRelevance(query,clusters){
	var i=0,n,
		normalGrams,
		subtopic,
		result,
		rank=1,
		maxClusters=10,
		newClusters=clusters.slice(),
		veticals=[],
		hits;
	
	//at most 10 bundles
	if(newClusters.length<maxClusters)	maxClusters=newClusters.length;
	//output results
	while(i<maxClusters){
		subtopic=newClusters[i].name;
		hits=newClusters[i].docs;
		veticals=newClusters[i].verticalHits;
		normalGrams=normalize(hits[0].title+' '+hits[0].description+' '+hits[1].title+' '+hits[1].description).split(/\s+/);
		var topicTerm=subtopic.split(/\s+/);
		for(n=0;n<topicTerm.length;n++){
			normalGrams.some(function(e){if(stemmer(e)===topicTerm[n]) return subtopic=subtopic.replace(topicTerm[n],e[0].toUpperCase()+e.slice(1)) });
		} 
		subtopic=subtopic[0].toUpperCase()+subtopic.slice(1);
		
		result = '';
		result += '<div class="search-result">';
		result += '<h3>'+subtopic+'</h3>'; 
		//result += '<h3>'+newClusters[i].SCORE+'</h3>'; 
		for(n=0;n<veticals.length;n++){
			if(n!=0)	result +='<hr>';		
			result += '<div>';
			veticals[n].map(function(e){
				result += htmlResult(e.rid, query, e, subtopic, i+1);
			});		
			result += '</div>';
		}
		result += '</div>'; 
		if(rank>4)	rank=4;
		$('#searsia-results-'+ rank).append(result);
		i++;
		rank++;
	}
}

function sortBundles(query,clusters){
	var newClusters=clusters,
		queryStem=toStem(query);
	newClusters=newClusters.map(function(e){scoreDocsOnBM25(e.name,e.docs); e.docs=sort(e.docs); return e;}); //score documents based on topic-documents relevance. By bm25 algorithm 
	newClusters=enforceVertical(newClusters);//enforce each bundle to have at least two verticals(if have more than two))
	newClusters=sortClusterRelevance(newClusters,queryStem);//sort bundles based on query-bundle relevance.
	//newClusters=newClusters.filter(function(e){return e.SCORE>0});
	newClusters=sortVerticalCluster(newClusters);//sort verticals in each bundle based on their returned documents number
	return newClusters;
}

function termFrequency(term,stem){
	var re,
		count=0,
		content=stem;
	
	re = new RegExp("\\b"+term+"\\b");
	while(re.test(content)==true){
		content = content.replace(re,"");
		count+=1;    
	}
	return count;
}

function BM25Score(query,hit,hits,aveLength){
	var n,re,
		tf=0,
		idf=0,
		k=1.2,b=0.75,
		score=0,
		newHits=hits,
		queryTerms=query.split(/\s+/),
		text=hit.stem;
			
	for(n=0;n<queryTerms.length;n++){
		newHits=hits;
		if(stopwordStem.indexOf(queryTerms[n])===-1){
			re = new RegExp("\\b"+queryTerms[n]+"\\b");
			newHits=newHits.filter(function(n){return re.test(n.stem)===true });
			idf=Math.log((1000-newHits.length+0.5)/(newHits.length+0.5));
			tf=termFrequency(queryTerms[n],hit.stem);
			score += idf*tf*(k+1)/(tf+k*(1-b+b*text.split(/\s+/).length/aveLength));
		}
	}
	return score;
}

function scoreDocsOnBM25(query,hits){
	var i=0,
		aveLength=0,
		text,
		aveScore=0;
	
	text = hits.map(function(e){return e.stem;}).reduce(
		function(a, b) { return b + ' ' + a;}
		,[]
	);
	aveLength=text.replace(/^\s+/,"").replace(/\s+$/,"").split(/\s+/).length/hits.length;
	
	i=0;
	while(i<hits.length){
		hits[i].SCORE=BM25Score(query,hits[i],hits,aveLength);
		aveScore+=hits[i].SCORE;
		i++;
	}
	return aveScore/hits.length;
}

function CheckChinese(query){     
	var reg = new RegExp("[\\u4e00-\\u9fa5]+","g");
	return reg.test(query);
}

function htmlResult(rid, query, hit, subtopic, subtopicRank) { // duplicate code with htmlSubResultWeb()
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image,
        maxsnip = 220,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result">';
    if (image != null) {
        result += '<a ' + clickElementforClickThrough(rid,query,subtopic,subtopicRank)
            + 'href="' + url + '"><img src="' + image + '"/></a>';
    }

    result += '<div class="descr"><a ' + clickElementforClickThrough(rid,query,subtopic,subtopicRank)
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
	if (hit.favicon != null) {
		result += ' <img src="' + hit.favicon + '" alt="" style="float: initial; height:1em; width:1em; margin:0; border: hidden;"> ';
    }
    if (descr != null) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</div>';
    if (url != null) {
        result += '<div class="url"><a ' + clickElementforClickThrough(rid,query,subtopic,subtopicRank)
            + 'href="' + url + '">' + highlightTerms(url, query) + '</a></div>';
    }
    result += '</div>';
    return result;
}

function clickElementforClickThrough(rid,query,subtopic,subtopicRank) {
    if (logClickDataUrl) {
        return ' onclick="logClickFed(this, \'' + rid + '\', \'' + query + '\', \'' + subtopic + '\', \'' + subtopicRank + '\')" ';
    }
    return '';
}

function logClickFed(element,rid,query,subtopic, subtopicRank) {
    if (logClickDataUrl) {
        //TODO make post call
	
        $.ajax({
            type: "GET",
            //url: convertUrlForClickThroughData($(element).attr('href'), rank, kind),
            url: "http://hifitz.com:1200/searsia/log?"+"id="+rid+"&q="+query+"&url="+$(element).attr('href')+"&subtopic="+subtopic+"&subtopicRank="+subtopicRank,
        }); 
    }
}