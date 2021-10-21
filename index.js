const _ = require('lodash');
const express = require('express');
const path = require('path');
const Hubspot = require('hubspot');

const CLIENT_ID = '0ba011fa-996e-4dea-9484-71218063070f';
const CLIENT_SECRET = 'f9693c75-7d68-4e58-99a9-92a63a127cd4';
const REDIRECT_URI = 'http://localhost:3000/oauth-callback';
const SCOPES = 'crm.objects.contacts.write crm.objects.contacts.read crm.objects.companies.write crm.objects.companies.read';

const port = 3000;
const app = express();
app.use(express.static('css'));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const hubspot = new Hubspot({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES
})

let tokenStore = {};

const isAuthorized = () => {
    return !_.isEmpty(tokenStore.refresh_token);
}

const checkAuthorization = (req, res, next) => {
    if (_.startsWith(req.url, '/error')) return next();
    if (_.startsWith(req.url, '/login')) return next();

    if (!isAuthorized()) return res.redirect('/login');

    next();
};

const getAllCompanies = async () => {
    const companiesResponse = await hubspot.companies.get({properties: ['name', 'domain']})

    return companiesResponse.companies;
};

const getCompaniesByDomain = async (domain) => {
    const data = {
        requestOptions: {properties: ['domain', 'name']},
        offset:{isPrimary:true, companyId:0}
    };

    const companiesResponse = await hubspot.companies.getByDomain(domain, data);

    return companiesResponse.results;
}

const prepareCompaniesForView = (companies) =>{
    return _.map(companies, (company)=>{
        const id = _.get(company, 'companyId');
        const name = _.get(company, 'properties.name.value');
        const domain = _.get(company, 'properties.domain.value');
        return {id, name, domain}
    })
};

app.get('/', checkAuthorization, (req, res) => {
    res.redirect('/companies');
});

app.get('/login', async (req, res) => {
    if (isAuthorized()) return res.redirect('/');
    res.render('login');
});

app.get('/oauth', async (req, res) => {
    const authorizationUrlParams = {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scopes: SCOPES,
    };

    const authorizationUrl = hubspot.oauth.getAuthorizationUrl(authorizationUrlParams);

    res.redirect(authorizationUrl);
});

app.get('/oauth-callback', async (req, res) => {
    const code = _.get(req, 'query.code');
    tokenStore = await hubspot.oauth.getAccessToken({code});
    hubspot.setAccessToken((tokenStore.access_token));
    res.redirect('/');
});

app.get('/companies', checkAuthorization, async (req, res) => {
    try {
        const search = _.get(req, 'query.search');
        const companiesResponse = _.isNil(search) ? await getAllCompanies() : await getCompaniesByDomain(search);
        const companies = prepareCompaniesForView(companiesResponse)
        res.render('companies', {companies})
    } catch (e) {
        console.log(e)
        res.redirect(`/error?msg=${e.message}`)
    }
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
})
