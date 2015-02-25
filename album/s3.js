
var s3 = function () {
    var my = {};
    var bucket, prefix;

    my.bucket = function(value) {
        if (!arguments.length) return bucket;
        bucket = value;
        return my;
    };

    my.prefix = function(value) {
        if (!arguments.length) return prefix;
        prefix = value;
        return my;
    };

	function _credential(username, passwd) {
		return CryptoJS.SHA1(username + ":" + passwd)
            .toString(CryptoJS.enc.Base64);
	};
	function _signer(data, passwd) {
		var keys = JSON.parse(
			CryptoJS.AES.decrypt(data, passwd).toString(CryptoJS.enc.Latin1));
        return function (path) {
            var AccessKey = keys["access_key"];
            var SecretKey = keys["secret_key"];
            var expires = Math.floor(new Date().getTime() / 1000) + 300;
            var stringToSign = "PUT\n\napplication/json\n" + expires + "\n"
                + path;
            var signature =
                CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(stringToSign,
                    SecretKey));
            return "?"
                + "AWSAccessKeyId=" + AccessKey
                + "&Expires=" + expires
                + "&Signature=" + encodeURIComponent(signature);
        }
	};
	function _encrypt_key(passwd, access_key, secret_key) {
		var keys = {
			"access_key": access_key,
			"secret_key": secret_key
		};
		return CryptoJS.AES.encrypt(JSON.stringify(keys), passwd).toString();
	};


    my.Listing = Backbone.Model.extend({
        url: function () {
            return "http://" + my.bucket() + "?delimiter=/&prefix="+my.prefix();
        },
        parse: function (xml) {
            var d = [];
            $(xml).find("CommonPrefixes").each(function () {
                var path = $(this).find("Prefix").text();
                var display = path.split("/")[1].replace(/ /g, "-");
                d.push({
                    "display": display,
                    "path": path
                });
            });
            return {
                "title": "Listing",
                "date": "",
                "directories": new Backbone.Collection(d)
            };
        },
        fetch: function (options) {
            options = options || {};
            options.dataType = "xml";
            return Backbone.Model.prototype.fetch.call(this, options);
        }
    });

    my.Auth = Backbone.Model.extend({
        dataType: "json",
        url: "/auth.json",
        initialize: function () {
            this.set("login:ready", false);
            this.set("login:success", false);
            this.set("signer", null);
        },
        get_auth: function () {
            var that = this;
            this.fetch({
                success: function() {
                    that.set("login:ready", true);
                    that.trigger("login:ready");
                }
            });
        },
        // options: { username, password, success, error }
        login: function(options) {
            success = options.success || function () { return null; };
            error = options.error || function () { return null; };
            if (this.get("login:success")) {
                success();
                this.trigger("login:success");
                return true;
            }
            var cred = _credential(options.username, options.password);
            if (!this.has(cred)) {
                error();
                this.trigger("login:error");
                return false;
            }
            this.set("signer", _signer(this.get(cred), options.password));
            this.set("login:success", true);
            this.set("username", options.username);
            this.trigger("login:success");
            success();
            return true;
        },
        logout: function () {
            this.set("login:success", false);
            this.set("signer", null);
            this.trigger("logout:success");
        },
        signature: function(path) {
            if (!this.get("login:success")) {
                return false;
            }
            return this.get("signer")(path);
        },
        // options: { username, password, access_key, secret_key }
        new_user: function(options) {
            var cred = _credential(options.username, options.password);
            var key_cipher = _encrypt_key(options.password, options.access_key,
                options.secret_key);
            this.set(cred, key_cipher);
        }
    });

    my.Manifest = Backbone.Model.extend({
        dataType: "json",
        save_manifest: function () {
            var that = this;
            this.trigger("manifest:saving");
            this.save(null, {
                data: JSON.stringify(this.toJSON()),
                contentType: "application/json",
                success: function () {
                    that.trigger("manifest:saved");
                },
                error: function (model, xhr, options) {
                    that.trigger("manifest:error");
                    console.log(xhr.responseText);
                }
            });
        },
        parse: function (json) {
            if (json.getResponseHeader)
                return;
            var contents = _.map(json.contents, function (item) {
                item.path = this.get("path") + item.name;
                item.thumb = this.get("path") + item.name.replace(/.jpg/i,
                    function (m) { return ".thumb" + m; });
                item.editable = false;
                item.show = (item.show == "true" || item.show == true)
                    ? true
                    : false;
                return item;
            }, this);
            return {
                "title": json.title,
                "date": json.date,
                "version": json.version,
                "contents": new Backbone.Collection(contents)
            };
        },
        sync: function (method, model, options) {
            options || (options = {});
            success = options.success || function () { return null; };
            error = options.error || function () { return null; };
            options.error = function (model, xhr, options) {
                if (xhr.status === 200 && xhr.responseText === "") {
                    success(model, xhr, options);
                } else {
                    error(model, xhr, options);
                }
            };
            switch (method) {
            case "read":
                options.url = this.get("path") + "manifest.json";
                break;
            case "create": /* FALLTHROUGH */
            case "update":
                var p = "/" + BUCKET + "/" + PREFIX
                    + encodeURIComponent(this.get("actual")) + "/manifest.json";
                options.url = this.get("path") + "manifest.json"
                    + this.get("auth").signature(p);
                options.type = "PUT";
                break;
            case "delete":
                console.log("unused method: delete");
                break;
            }
            return Backbone.sync(method, model, options);
        },
        toJSON: function () {
            json = _.omit(this.attributes, "actual", "display", "path", "auth");
            json.contents = _.map(this.get("contents").toJSON(),function (item){
                return _.omit(item, "thumb", "path", "editable");
            });
            return json;
        },
    });

    return my;
}();

