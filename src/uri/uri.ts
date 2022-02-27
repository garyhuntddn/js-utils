/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A list of characters to be excluded/removed from the room component/segment
 * of a conference/meeting URI/URL. The list is based on RFC 3986 and the jxmpp
 * library utilized by jicofo.
 */
const _ROOM_EXCLUDE_PATTERN = '[\\:\\?#\\[\\]@!$&\'()*+,;=></"]';

/**
 * The {@link RegExp} pattern of the authority of a URI.
 */
const _URI_AUTHORITY_PATTERN = '(//[^/?#]+)';

/**
 * The {@link RegExp} pattern of the path of a URI.
 */
const _URI_PATH_PATTERN = '([^?#]*)';

/**
 * The {@link RegExp} pattern of the protocol of a URI.
 *
 * FIXME: The URL class exposed by JavaScript will not include the colon in
 * the protocol field. Also in other places (at the time of this writing:
 * the DeepLinkingMobilePage.js) the app link scheme does not include
 * the double dots, so things are inconsistent.
 */
export const URI_PROTOCOL_PATTERN = '^([a-z][a-z0-9\\.\\+-]*:)';

/**
 * Excludes/removes certain characters from a specific room (name) which are
 * incompatible with Jitsi Meet on the client and/or server sides.
 *
 * @param room - The room (name) to fix.
 */
const _fixRoom = ( room?: string ) => ( room
    ? room.replace( new RegExp( _ROOM_EXCLUDE_PATTERN, 'g' ), '' )
    : room );

/**
 * Fixes the scheme part of a specific URI (string) so that it contains a
 * well-known scheme such as HTTP(S). For example, the mobile app implements an
 * app-specific URI scheme in addition to Universal Links. The app-specific
 * scheme may precede or replace the well-known scheme. In such a case, dealing
 * with the app-specific scheme only complicates the logic and it is simpler to
 * get rid of it (by translating the app-specific scheme into a well-known
 * scheme).
 *
 * @param uri - The URI (string) to fix the scheme of.
 */
const _fixURIStringScheme = ( uri: string ) => {
    const regex = new RegExp( `${ URI_PROTOCOL_PATTERN }+`, 'gi' );
    const match = regex.exec( uri );

    if ( match ) {
        // As an implementation convenience, pick up the last scheme and make
        // sure that it is a well-known one.
        let protocol = match[ match.length - 1 ].toLowerCase();

        if ( protocol !== 'http:' && protocol !== 'https:' ) {
            protocol = 'https:';
        }

        /* eslint-disable no-param-reassign */

        uri = uri.substring( regex.lastIndex );
        if ( uri.startsWith( '//' ) ) {
            // The specified URL was not a room name only, it contained an
            // authority.
            uri = protocol + uri;
        }

        /* eslint-enable no-param-reassign */
    }

    return uri;
};

/**
 * Gets the (Web application) context root defined by a specific location (URI).
 *
 * @param {Object} location - The location (URI) which defines the (Web
 * application) context root.
 * @returns - The (Web application) context root defined by the
 * specified {@code location} (URI).
 */
export const getLocationContextRoot = ( { pathname }: { pathname: string } ): string => {
    const contextRootEndIndex = pathname.lastIndexOf( '/' );

    return (
        contextRootEndIndex === -1
            ? '/'
            : pathname.substring( 0, contextRootEndIndex + 1 ) );
};

/**
 * Constructs a new {@code Array} with URL parameter {@code String}s out of a
 * specific {@code Object}.
 *
 * @param obj - The {@code Object} to turn into URL parameter
 * {@code String}s.
 * @returns The {@code Array} with URL parameter {@code String}s
 * constructed out of the specified {@code obj}.
 */
const _objectToURLParamsArray = ( obj: { [ key: string ]: unknown } = {} ): Array<string> => {
    const params = [];

    for ( const key in obj ) { // eslint-disable-line guard-for-in
        try {
            params.push(
                `${ key }=${ encodeURIComponent( JSON.stringify( obj[ key ] ) ) }` );
        } catch ( e ) {
            console.warn( `Error encoding ${ key }: ${ e }` );
        }
    }

    return params;
};

type Uri = {
    hash?: string;
    toString: ( value?: unknown ) => string;
    host?: string;
    hostname?: string;
    pathname: string;
    port?: string;
    protocol?: string;
    search?: string;
};

// TODO: the reference to this here feels wrong
/**
 * Implements {@code href} and {@code toString} for the {@code Object} returned
 * by {@link #parseStandardURIString}.
 *
 * @param [thiz] - An {@code Object} returned by
 * {@code #parseStandardURIString} if any; otherwise, it is presumed that the
 * function is invoked on such an instance.
 */
const _standardURIToString = ( thiz: unknown ): string => {
    // eslint-disable-next-line no-invalid-this
    const { hash, host, pathname, protocol, search } = (thiz || this) as any;
    let str = '';

    protocol && ( str += protocol );

    // TODO userinfo

    host && ( str += `//${ host }` );
    str += pathname || '/';
    search && ( str += search );
    hash && ( str += hash );

    return str;
};

/**
 * Parses a specific URI string into an object with the well-known properties of
 * the {@link Location} and/or {@link URL} interfaces implemented by Web
 * browsers. The parsing attempts to be in accord with IETF's RFC 3986.
 *
 * @param str - The URI string to parse.
 */
export const parseStandardURIString = ( str: string ): Uri => {
    /* eslint-disable no-param-reassign */

    const obj = {
        toString: _standardURIToString
    } as Uri;

    let regex: RegExp;
    let match: RegExpExecArray;

    // XXX A URI string as defined by RFC 3986 does not contain any whitespace.
    // Usually, a browser will have already encoded any whitespace. In order to
    // avoid potential later problems related to whitespace in URI, strip any
    // whitespace. Anyway, the Jitsi Meet app is not known to utilize unencoded
    // whitespace so the stripping is deemed safe.
    str = str.replace( /\s/g, '' );

    // protocol
    regex = new RegExp( URI_PROTOCOL_PATTERN, 'gi' );
    match = regex.exec( str );
    if ( match ) {
        obj.protocol = match[ 1 ].toLowerCase();
        str = str.substring( regex.lastIndex );
    }

    // authority
    regex = new RegExp( `^${ _URI_AUTHORITY_PATTERN }`, 'gi' );
    match = regex.exec( str );
    if ( match ) {
        let authority = match[ 1 ].substring(/* // */ 2 );

        str = str.substring( regex.lastIndex );

        // userinfo
        const userinfoEndIndex = authority.indexOf( '@' );

        if ( userinfoEndIndex !== -1 ) {
            authority = authority.substring( userinfoEndIndex + 1 );
        }

        obj.host = authority;

        // port
        const portBeginIndex = authority.lastIndexOf( ':' );

        if ( portBeginIndex !== -1 ) {
            obj.port = authority.substring( portBeginIndex + 1 );
            authority = authority.substring( 0, portBeginIndex );
        }

        // hostname
        obj.hostname = authority;
    }

    // pathname
    regex = new RegExp( `^${ _URI_PATH_PATTERN }`, 'gi' );
    match = regex.exec( str );

    let pathname: string;

    if ( match ) {
        pathname = match[ 1 ];
        str = str.substring( regex.lastIndex );
    }
    if ( pathname ) {
        pathname.startsWith( '/' ) || ( pathname = `/${ pathname }` );
    } else {
        pathname = '/';
    }
    obj.pathname = pathname;

    // query
    if ( str.startsWith( '?' ) ) {
        let hashBeginIndex = str.indexOf( '#', 1 );

        if ( hashBeginIndex === -1 ) {
            hashBeginIndex = str.length;
        }
        obj.search = str.substring( 0, hashBeginIndex );
        str = str.substring( hashBeginIndex );
    } else {
        obj.search = ''; // Google Chrome
    }

    // fragment
    obj.hash = str.startsWith( '#' ) ? str : '';

    /* eslint-enable no-param-reassign */
    return obj;
};

type UriExtended = Uri & {
    contextRoot?: string;
    room?: string;

};

/**
 * Parses a specific URI which (supposedly) references a Jitsi Meet resource
 * (location).
 *
 * @param uri - The URI to parse which (supposedly)
 * references a Jitsi Meet resource (location).
 */
export const parseURIString = ( uri?: string ): UriExtended | undefined => {
    if ( typeof uri !== 'string' ) {
        return undefined;
    }

    const obj: UriExtended = parseStandardURIString( _fixURIStringScheme( uri ) );

    // Add the properties that are specific to a Jitsi Meet resource (location)
    // such as contextRoot, room:

    // contextRoot
    obj.contextRoot = getLocationContextRoot( obj );

    // The room (name) is the last component/segment of pathname.
    const { pathname } = obj;

    // XXX While the components/segments of pathname are URI encoded, Jitsi Meet
    // on the client and/or server sides still don't support certain characters.
    const contextRootEndIndex = pathname.lastIndexOf( '/' );
    let room = pathname.substring( contextRootEndIndex + 1 ) || undefined;

    if ( room ) {
        const fixedRoom = _fixRoom( room );

        if ( fixedRoom !== room ) {
            room = fixedRoom;

            // XXX Drive fixedRoom into pathname (because room is derived from
            // pathname).
            obj.pathname
                = pathname.substring( 0, contextRootEndIndex + 1 ) + ( room || '' );
        }
    }
    obj.room = room;

    return obj;
};

type UrlProperties = Partial<{
    serverURL: string;
    room: string;
    url: string;
    protocol: string;
    scheme: string;
    domain: string;
    host: string;
    hostname: string;
    appLinkScheme: string;
    roomName: string;
    jwt: string;
}>;

/**
 * Attempts to return a {@code String} representation of a specific
 * {@code Object} similar to the one accepted by the constructor
 * of Web's ExternalAPI.
 *
 * @param o - The URL to return a {@code String} representation of.
 * @returns - A {@code String} representation of the specified
 * {@code Object}.
 */
export const urlObjectToString = ( o: UrlProperties ): string => {
    // First normalize the given url. It come as o.url or split into o.serverURL
    // and o.room.
    let tmp: string;

    if ( o.serverURL && o.room ) {
        tmp = new URL( o.room, o.serverURL ).toString();
    } else if ( o.room ) {
        tmp = o.room;
    } else {
        tmp = o.url || '';
    }

    const url = parseStandardURIString( _fixURIStringScheme( tmp ) );

    // protocol
    if ( !url.protocol ) {
        let protocol = o.protocol || o.scheme;

        if ( protocol ) {
            // Protocol is supposed to be the scheme and the final ':'. Anyway,
            // do not make a fuss if the final ':' is not there.
            protocol.endsWith( ':' ) || ( protocol += ':' );
            url.protocol = protocol;
        }
    }

    // authority & pathname
    let { pathname } = url;

    if ( !url.host ) {
        // Web's ExternalAPI domain
        //
        // It may be host/hostname and pathname with the latter denoting the
        // tenant.
        const domain = o.domain || o.host || o.hostname;

        if ( domain && o.appLinkScheme ) {
            const { host, hostname, pathname: contextRoot, port }
                = parseStandardURIString(

                    // XXX The value of domain in supposed to be host/hostname
                    // and, optionally, pathname. Make sure it is not taken for
                    // a pathname only.
                    _fixURIStringScheme( `${ o.appLinkScheme }//${ domain }` ) );

            // authority
            if ( host ) {
                url.host = host;
                url.hostname = hostname;
                url.port = port;
            }

            // pathname
            pathname === '/' && contextRoot !== '/' && ( pathname = contextRoot );
        }
    }

    // pathname

    // Web's ExternalAPI roomName
    const room = o.roomName || o.room;

    if ( room
        && ( url.pathname.endsWith( '/' )
            || !url.pathname.endsWith( `/${ room }` ) ) ) {
        pathname.endsWith( '/' ) || ( pathname += '/' );
        pathname += room;
    }

    url.pathname = pathname;

    // query/search

    // Web's ExternalAPI jwt
    const { jwt } = o;

    if ( jwt ) {
        let { search } = url;

        if ( search.indexOf( '?jwt=' ) === -1 && search.indexOf( '&jwt=' ) === -1 ) {
            search.startsWith( '?' ) || ( search = `?${ search }` );
            search.length === 1 || ( search += '&' );
            search += `jwt=${ jwt }`;

            url.search = search;
        }
    }

    // fragment/hash

    let { hash } = url;

    for ( const urlPrefix of [ 'config', 'interfaceConfig', 'devices' ] ) {
        const urlParamsArray
            = _objectToURLParamsArray(
                o[ `${ urlPrefix }Overwrite` ]
                || o[ urlPrefix ]
                || o[ `${ urlPrefix }Override` ] );

        if ( urlParamsArray.length ) {
            let urlParamsString
                = `${ urlPrefix }.${ urlParamsArray.join( `&${ urlPrefix }.` ) }`;

            if ( hash.length ) {
                urlParamsString = `&${ urlParamsString }`;
            } else {
                hash = '#';
            }
            hash += urlParamsString;
        }
    }

    url.hash = hash;

    return url.toString() || undefined;
};

/**
 * Attempts to return a {@code String} representation of a specific
 * {@code Object} which is supposed to represent a URL. Obviously, if a
 * {@code String} is specified, it is returned. If a {@code URL} is specified,
 * its {@code URL#href} is returned. Additionally, an {@code Object} similar to
 * the one accepted by the constructor of Web's ExternalAPI is supported on both
 * mobile/React Native and Web/React.
 *
 * @param {Object|string} obj - The URL to return a {@code String}
 * representation of.
 * @returns - A {@code String} representation of the specified
 * {@code obj} which is supposed to represent a URL.
 */
export const toURLString = ( obj: unknown ) => {
    switch ( typeof obj ) {
        case 'object':
            if ( obj ) {
                if ( obj instanceof URL ) {
                    return obj.href;
                }

                return urlObjectToString( obj );
            }
            break;

        case 'string':
            return String( obj );
    }

    return undefined;
};