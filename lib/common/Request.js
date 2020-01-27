const req = require('request');
const util = require('util');
const hash = require('../nibss/common/Hash');
const { Handler, ApiErrors, ModuleError } = require('./utils/errors');

const request = util.promisify(req);

exports.trigger = async({
    method = 'POST', path, credentials, payload,
}) => {
    let headers,
        encryptedBVN,
        bvnData;
    const baseURL = credentials.host || 'https://sandboxapi.fsi.ng';

    try {
        const OrganisationCode = Buffer.from(credentials.organisation_code || '').toString('base64');

        if (credentials.aes_key && credentials.ivkey) {
            const {
                aes_key, ivkey, password, organisation_code,
            } = credentials;
            encryptedBVN = hash.encrypt(JSON.stringify(payload), aes_key, ivkey);
            bvnData = hash.BVNData(organisation_code, password);

            headers = {
                Authorization: bvnData.authHeader,
                SIGNATURE: bvnData.signatureHeader,
                SIGNATURE_METH: bvnData.signatureMethodHeader,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            };
        }

        const options = {
            uri: `${baseURL}${path}`,
            headers: {
                'Sandbox-Key': credentials.sandbox_key,
                OrganisationCode,
                ...headers,
            },
            method,
            body: encryptedBVN,
        };
        let data,
            result;

        const response = await request(options);
        if (response.body) {
            result = JSON.parse(response.body);
            if (!result.error_code) {
                data = JSON.parse(hash.decrypt(result, credentials.aes_key, credentials.ivkey));
                return data;
            }
            return result;
        }
        data = {
            password: response.headers.password,
            ivkey: response.headers.ivkey,
            aes_key: response.headers.aes_key,
        };
        return data;
    } catch (error) {
        if (error.statusCode) {
            throw new ApiErrors(Handler.Api(error.statusCode));
        }
        throw new ModuleError(Handler.Module(error));
    }
};