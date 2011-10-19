/*!***************************************************************************
 * meelo-templates
 * 
 * @date		$Date: 2010-08-26 15:23:05 +0300 (Thu, 26 Aug 2010) $
 * @revision 	$Rev: 20 $
 * @author		$Author: rudas.n $
 * @copy		(c) Copyright 2009 Nicolas Rudas. All Rights Reserved.
 * @licence		MIT Licensed
 * @latest		https://github.com/rudasn/meelo-templates
 * 
 *****************************************************************************/
(function() {
	if(typeof console === 'undefined'){ console = false; }
	if(typeof window === 'undefined'){ window = {}; }
	if(typeof document === 'undefined'){ document = false; }
	if(typeof jQuery === 'undefined'){ jQuery = false; }
	
	var meelo = window.meelo = window.meelo || {};
	
	var T = meelo.Template = function (opts){
		var self = this;
		opts = (typeof opts === 'string') ? { text: opts } : opts;
		
		this.text = opts && opts.text || '';
		this.name = opts && opts.name || ''+Math.floor(Math.random()*new Date().valueOf());	
		
		this.out = null;
		
	//	'private' variables
		this.__context__data = {}; // 'save as' variables
		this.__extends = null; // string, another template's name
		this.__blocks = {};
		this.__retrieved = false; // object
		
		T.list[this.name] = this; // save a reference

		console && console.log('new template:',this.name,this);

		this.setup(opts);
				
		return this;
	};
	
	T.debug = true;
	T.list = {};
	
	// ===========
	// = Methods =
	// ===========
	T.prototype.setup = function(opts) {
		this.url = opts && opts.url || this.url || null;
		this.cache = opts && opts.cache || this.cache || null;
		this.dom = opts && opts.dom || this.dom || null;
		this.dom && typeof this.dom === 'function' && (this.dom = this.dom());
		this.__data = opts && opts.data || this.__data || null; // object
		
	//	console.info(opts.data, this.__data)
		
		opts.text && this.setText(opts.text);
		
		return this;		
	};
	
	T.prototype.setText = function(text) {
	//	Change or set the text of this template
		
		this.__source = text && T.trim(text)
								.replace(/([\n\r])/g,'__nl__').replace(/(["'])/g,'\\$1').replace(/\\\\/g,'\\') + "<%%>";
		
		this.text = text || this.text;
		
		this.__source && (this.__processed = this.process()); // process this template on load
		
		return this;
	};
	
	T.prototype.retrieve = function(data,callback) {
		var self = this,
			url = this.url;
	
	//	Render original text (which could be loading text or something else temporary)
	//	render();
	//	No url, just text
		!url && render();
		
	//	From cache	
		url && self.cache && self.__retrieved && render( self.__retrieved.processed );
	
	//	From URL
		url && (!self.cache || !self.__retrieved) && jQuery && jQuery.get(url,function(text) {
			self.__retrieved = {
				text: text,
				source: T.trim(text).replace(/([\n\r])/g,'__nl__').replace(/(["'])/g,'\\$1') + "<%%>",
				processed: self.process( text )
			};

			render(self.__retrieved.processed);
		});
		
		function render(text){
		//	text && console.warn('must have proccessed')
			callback && callback.call(self, self.render(data, text ) );
		}
		
		return this;
	};
	
	T.prototype.process = function(text) {
	//	Take some text and convert it to something
	//	the render function can work with.
	//	ie. apply template logic
		console && console.time('Process');
		var self = this;
		text = (text && T.trim(text).replace(/([\n\r])/g,'__nl__').replace(/(["'])/g,'\\$1') + "<%%>") || this.__source;
		
		var tags = T.tags;
		
		
	//	Tags {% tag %}	
		for(var m in tags){
			var tag = tags[m],
				tag_start_match = tag.start_with && text.match(tag.start_with),
				tag_end_match = tag.end_with && text.match(tag.end_with),
				tag_start_return  = tag.start_return,
				tag_end_return  = tag.end_return;

			if(tag_start_match && tag_start_return){
				text = text.replace( tag.start_with, function() {
					return tag_start_return.apply(self,arguments);
				});
			}
			
			if(tag_end_match && tag_end_return){
				text = text.replace( tag.end_with, function() {
					return tag_end_return.apply(self,arguments);
				});
			}
		};
	
	//	Variables {{ var }}
		text = text.replace(/\{\{(.*?)\}\}/g,function(s,var_name) {
			var save_as = false;
			var_name = var_name.replace(/\s+as\s+(\w+)(\:eat)?\s*$/,function(s,as,eat) {
				save_as = {
					name: as,
					eat: eat
				};
				return '';
			});

			var	check_for_filters = var_name.split('|'),
				filters = check_for_filters[1], // anything after first pipe is a filter
				var_name = T.trim(check_for_filters[0]);  // anything before is the variable
			
			
			if(!var_name || (var_name && !var_name.length)) { return ''; }
		
		//	variables can also be strings
		//	i.e. allow strings inside {{ }}

			var_name = T.params(var_name)[0];
			//	T.fixParamQuotes(var_name,1)[0];

			
			if(filters){
				filters = check_for_filters.slice(1);

				for (var i = filters.length - 1; i >= 0; i--){
					var filter_name = filters[i].split(':')[0].replace(/\s/g,''),
						filter_params = filters[i].split(':')[1],
						filter = T.filters[filter_name];

					if(!filter){continue;}

					var_name = filter(var_name,filter_params);
				}
			}
			
			ret = (save_as && save_as.eat) ? '' : '<%ret.push('+var_name+')%>';
			
			(save_as
				&& ( save_as = '<%var '+save_as.name+' = self.__context__data["'+save_as.name+'"] = '+var_name+';%>')
				|| (save_as = ''));

			return save_as+ret;
		});
	
	//	JS Code <% code %>
	//	Anything inside <% %> is evaled as is
		text = text.replace(/(.*?)\<\%(.*?)\%\>/g,function(s,before,body) {
			return 'ret.push("'+before+'");'+body+';';
		});
		
	//	this.__processed = text;
		
		console && console.timeEnd('Process');	
		
		return text;
	};
	
	T.prototype.render = function(data,processed) {
	//	Apply data on template's processed text
	//	and return output
		console && console.time('Render');	

		var self = this,
			out = processed || this.__processed,// = this.__processed || this.process(),
			data_string, extend;
		
		if(!out){console && console.error('NO OUT'); return '';}
		
		out = out.replace(/(\\\{|\\\})/g,'$1');
		
		data = data || this.__data || {};
		
		try {
			data = (typeof data === 'string') ? data_string = data && eval('('+data+')') : data; }

		catch(e) {
			if(T.debug) {
				return T.debug_data_error.apply(e,[data,data_string]); }
			else {
				return T.data_error.apply(e,[data,data_string]); } 	}

		this.__data = data;
		
//		console.warn(this.name,data)
		
		try {
			out = eval('(function text_eval(data) {\
				var ret = [];\
				with(data){'+out+';}\
				return ret.join(\'\');\
			}).call(self,data);'); }

		catch(e){	
			if(T.debug) {
				return T.debug_render_error.apply(e,[data,data_string,out]); }
			else {
				return T.render_error.apply(e,[data,data_string,out]); } }
		
		out = T.revertLineBreaks(out);
		
	//	Extend template
		extend = (this.__extends && this.extend());
		if(extend && !document) {
		//	If there was a document, template was extended in extend method (below)
			out = extend.render() + out; }
		
		console && console.timeEnd('Render');				
					
		return this.out = out;
	};
	
	T.prototype.renderToDOM = function(data) {
		var self = this;
		
		this.dom && this.retrieve(data,function(r) {
			this.dom && (this.dom.innerHTML = r);			
		});
		
		return this;
	};
	
	T.prototype.extend = function(template_name) {
	//	Replace the blocks of another template
	//	with the blocks of this template		
		template_name = template_name || this.__extends;
		var template = T.list[template_name];
					
		if(!template){ // should import template if it does not exist
			//throw new Error('No such template exists ' + template_name,'');
			return; }
		
		var self_blocks = this.__blocks,
			extend_blocks = template.__blocks,
			ret;
		
		for(var block in self_blocks){	
			var extend_block = extend_blocks[block],
				with_block = self_blocks[block];
			
			var new_contents = T.revertLineBreaks(with_block.contents);
			
			if (document && block === 'title') {
			//	title is a special, reserved block for document.title
			//	Doc's title is changed in block tag method (T.tags.block), not here
				continue; }
			
			if( extend_block ) {
			//	Save its contents so that when template is unloaded (unload method)
			//	this block's contents are reverted back to original value
				extend_block.__default__contents = extend_block.__default__contents || extend_block.contents;
				extend_block.contents = new_contents;

				if(document) {
				//	Each block must have unique name, because that's its ID
					var block_in_dom = document.getElementById(extend_block.id);
					block_in_dom && (block_in_dom.innerHTML = new_contents); }
				
				else { // server-side templates ?
					ret = template;	}
			}				
		}
		
				
		return ret;
	};
	
	T.prototype.unload = function() {
	//	Remove this template and revert blocks it extended
	//	back to their original values
		var self_blocks = this.__blocks,
			extended_template = this.__extends,
			template = T.list[extended_template];
		
		if(!template){ return; }// template does not exist
		
		for(var block in self_blocks){	
			var extend_block = template.__blocks[block],
				with_block = self_blocks[block];
			
			if (document && block === 'title') {
			//	title is a special, reserved block for document.title
				document.title = with_block.document_title;
				continue; }
			
			if( extend_block ) {
			//	Revert contents to original
				var new_contents = extend_block.contents = extend_block.__default__contents || '';
				
				new_contents = T.revertLineBreaks(new_contents);
				
				if(document) {
					var block_in_dom = document.getElementById(extend_block.id);
					block_in_dom.innerHTML = new_contents; }

				//else { // server-side templates
				//	ret = template;	}

			}
		}

		
		return this;
	};
	
	T.prototype.__parse_block = function(name) {
		var block = this.__blocks[name];
		
		var p = block.contents = this.render(false, this.process(block.contents) );
		
		if(name == 'title' && document) {
			block.document_title = document.title;
			document.title = p;
			return '';
		}
				
		return '<section id="'+block.id+'">'+p+'</section>';
	};

	// ===============
	// = Tags {%  %} =
	// ===============
	T.tags = {
		'template': { // LIKE BLOCK
		//	Define and instantiate a new template from within a template
		//	{% template template_name %} my new template's contents {% endtemplate %}
		//	The new template will not be rendered.
			start_with: /\{\%\s*template\s*(\w+)\s*(\|\s*(render))?\s*\%\}(.*?)\{\%\s*endtemplate\s*\%\}/gi,
			start_return: function(s,name,f,filter,text) {
				var template = T.list[name] || new T({name: name }),
					data = 'T.list["'+name+'"].__data = data;',
					placeholder = '<section id=\'meelo-template-placeholder-'+name+'\'></section>';
								
				template.setText(text);
				
				if(filter && filter === 'render') {
					return  '<%'+data+'ret.push(T.list["'+name+'"].render())%>'; }
				
				return placeholder+'<%'+data+'%>';
			//	return '<%new T({name: "'+name+'", text: "'+text+'", data: data});%>';
			}
		},
		'block': {
			start_with: /\{\%\s*block\s+(\w+)\s*\%\}(.*?)\{\%\s*endblock\s*\%\}/gi,
			start_return: function(s,block_name,contents){
				//contents = T.params(contents)[0];

				var id = 'meelo-template-block-'+block_name;
				
				var block = this.__blocks[block_name] = {
					contents: contents,
					id: id
				};
				
				return '<%ret.push(this.__parse_block("'+block_name+'"))%>';
			}
		},
		'extend': {
			start_with: /\{\%\s*extends\s+(.*?)\s*\%\}/gi,
			start_return: function(s,template_name) {
			//	template_name = T.fixParamQuotes(template_name,1)[0];
				template_name = T.params(template_name)[0];
				return '<%this.__extends = '+template_name+'%>';
			}
		},
		'code': {
			start_with: /\{\%\s*code\s*\%\}(.*?)\{\%\s*endcode\s*\%\}/gi,
			start_return: function(s,body) {
				body = T.escape(body,'html');
				if(!body){return '';}
				return '<%ret.push(\"'+body.replace(/([\{\}])/g,'\\$1').replace(/(\%)/g,'\\$1').replace(/\\\\/g,'\\')+'\")%>';
			}
		},
		'first_of': {
		// summary: Given a string of space separated values
		//			return the first value that is not false or null or empty
		// syntax: 	{% firstof var1,var2,var3,"default value" %}
			start_with: /\{\%\s*firstof\s+(.*?)\s*\%\}/gi,
			//start_with: /\{\%\s*firstof\s+((\w|\.|\s|\\\"|\\\')*?)\s*\%\}/gi,
			start_return: function(s,params) {
				params = T.params(params).join(' || ');
						// T.sanitiseParams(params,' || ',' ')
				return '<%ret.push('+params+')%>';
			}				
		},
		'now(date)':{
		// summary: Return the current date/time, with optional formatting
		// syntax: 	{% now %} 							returns Thu Jun 11 2009 10:06:27 GMT+0300 (EEST) 
		//			{% now "%DD, %dd/%mm/%yy, %tp" %}	returns Thursday, 11/06/2009, 10:05 a.m.
		//	start_with: /\{\%\s*now(\s+\\[\'\"]\s*(.*?)\s*\\[\'\"])?\s*\%\}/gi,
			start_with: /\{\%\s*now(\s*(.*?))\s*\%\}/gi,
			start_return: function(s,a,format) {
				if(!format || (format && !format.length)){
					return new Date().toString();}
				format = T.params(format).join('');
				return '<%ret.push('+T.formatDate("today",format)+')%>';
//				return T.formatDate("today",format);
			}
		},
		'regroup':{
		// summary: Group items in a key/value paired object by the specified key
		// syntax: 	{% regroup my_object by a_key as my_grouped_object %}
			start_with: /\{\%\s*regroup\s+((\w|\.|\s)*?)\s+by\s+(\w+)\s+as\s+(\w+)\s*\%\}/gi,
			start_return: function(s,which,a,by,as) {
				return '\
				<%var '+as+' = (function() {\
					var __regroup_return = [],\
						__regroup_ID = '+new Date().valueOf()+';\
					for(var __regroup_ID in '+which+') {\
						var item = '+which+'[__regroup_ID],\
							by_value = item[\"'+by+'\"],\
							exists = T.inObjArray(by_value,"grouper",__regroup_return);\
						if (!item || !by_value) { continue; }\
						if ( exists === -1  ) {\
							__regroup_return.push(T.extend({\
								grouper: by_value,\
								items: [ item ]\
							},item));\
						} else {\
							exists = __regroup_return[exists];\
							exists.items.push(item);\
						}\
					}\
					return __regroup_return;\
				})();%>';
			}
		},
		'if': {
		// summary: Conditional statements as usual
		// syntax: 	{% if var1 is true  %} do this
		//			{% elseif var1 is "Green" %} do that
		//			{% elseif var1 is "Blue" and var2 not "Red" %} do that
		// 			{% endif %}
		//			... 
			start_with: /\{\%\s*if\s+(.*?)\s*\%\}/gi,			
			end_with: /\{\%\s*(endif|elseif|else)\s*(.*?)\s*\%\}/gi,
			param_filter: function(params) {
				params = T.params(params).join(' ');
					//T.trim(T.sanitiseParams(params,' ',''));

				params = params
							.replace(/\b(not\s+is|is\s+not)\b/g,'!==')
							.replace(/\bis\b/g,'==')
							.replace(/\bnot\b/g,'!')
							.replace(/\bor\b/g,'||')
							.replace(/\band\b/g,'&&');
				return params;
			},
			start_return: function(s,params) {
				params = T.tags['if'].param_filter(params);
				return '<%if('+params+') {%>';
			},
			end_return: function(s,type,params) {
				if(type == 'endif') {
					type = ''; 	}
				else if (type == 'elseif') {
					params = T.tags['if'].param_filter(params);
					type = 'else if ('+params+') {';
				}
				else if (type === 'else') {
					type = 'else {'; }

				return '<%}'+type+'%>';
			}
		},
		'loop': { // tis poutanas alla doulefki!
			start_with: /\{\%\s*for\s+(\w+)\s+in\s+(.*?)\s*\%\}/gi,
			end_with: /\{\%\s*endfor\s*\%\}/gi,
			start_return: function(string,var_name,obj_name) {
				var var_name_id = var_name + new Date().valueOf();
				return '\
					<% (function() {if(typeof '+obj_name+' !== \'undefined\'){\
						var __counter = 0;\
						if('+obj_name+'.constructor === Array) {\
							var vars = \"var ___length = '+obj_name+'.length, \
									'+var_name+' = '+obj_name+'['+var_name_id+'],\
									forloop = { counter: ___length - '+var_name_id+', counter0: ___length - '+var_name_id+' -1 , length: ___length, first: '+var_name_id+' === ___length - 1, last: '+var_name_id+' === 0 };\";\
						} else if('+obj_name+'.constructor === Object) {\
							'+obj_name+' = T.ObjectToArray('+obj_name+');\
							var vars = \"var ___length = '+obj_name+'.length, \
									'+var_name+' = '+obj_name+'['+var_name_id+'][0],\
									forloop = { counter: ___length - '+var_name_id+', counter0: ___length - '+var_name_id+' -1 , length: ___length, first: '+var_name_id+' === ___length - 1, last: '+var_name_id+' === 0 };'+obj_name+'.'+var_name+' = '+obj_name+'['+var_name_id+'][1];\";\
						}else {return;}\
						for(var '+var_name_id+' = '+obj_name+'.reverse().length - 1; '+var_name_id+'>=0; '+var_name_id+'--) {\
							(function() {\
								__counter++;\
								eval(vars);\
								if('+var_name_id+' === 0) { '+obj_name+'.reverse(); }\
						%>';
			},
			end_return: function() {
				return '<%;})();};}})();%>';
			}

		},
		'filter': {
		// summary: Apply filters to the contents of this tag
		// syntax: {% filter flag1 | flag2 | flag3:"flag3_options" %}
		//				some text or {{ variables }} but no \{\% tags \%\}
		//			{% end filter %}
			start_with: /\{\%\s*filter\s+(.*?)\%\}(.*?)\{\%\s*endfilter\s*\%\}/gi,
			start_return: function(s,filters,contents) {
				contents = contents + '{{}}';
				return contents.replace(/(.*?)\{\{(.*?)\}\}/gi,function(s,before,body) {
					body = (body && T.trim(body).length)
							? '{{'+body + ' | '+filters+' }}'
							: '';
					before = (before && T.trim(before).length)
							? '{{ "'+before+'" | '+filters+' }}'
							: '';
					
				//	console.warn(body,'\n\n',before);
					
					return before+body;
				});
			}
		},
		'cycle': {
		// summary: Successively return one of the values specified
		//			whenever the same cycle tag is called
		// syntax: 	{% cycle "blue" "red" green %}
		//				will return blue (string) the first time, red the second,
		//				green (variable) the third, blue the fourth, etc...  
			start_with: /\{\%\s*cycle\s+(.*?)\s*\%\}/gi,
			start_return: function(s,values) {
				if(!values){return '';}
				
				values = T.params(values);
				
				return '<%ret.push('+T.cycle(values)+')%>';
			}				
		},
		'data': {
			start_with: /\{\%\s*data\s*\%\}/gi,
			start_return: function() {
				return '<%ret.push(T.objectTree(data))%>';
			}
		}
		
			
	};


	// ===========
	// = Filters =
	// ===========
	//	These most probably return a string to be evaled
	//	ie. they are of no use outside of a template and data scope
	//	Filters are applied to variables not block tags
	T.filters = {
		'default': function(value,params){
			params = T.params(params).join('');
			return '((typeof '+value+' !== "undefined" && '+value+') ? '+value+' : '+params+')';
		},
		'random': function(value) {
			return 'T.random('+value+')';
		},
		'count': function(value) {
			return '(('+value+' && '+value+'.constructor === Array) ? '+value+'.length : 0)';
		},
		'title': function(value) {
			return 'T.titlecase('+value+')';
		},
		'truncate_words': function(value,params) {
			params = [value].concat(T.params(params));
			return 'T.truncatewords('+params.join(',')+')';
		},
		'truncate_sentences': function(value,params) {
			params = [value].concat(T.params(params));
			return 'T.truncatesentences('+params.join(',')+')';
		},
		'pluralise': function(value,params) {
			params = [value].concat(T.params(params));
			return 'T.pluralise('+params.join(',')+')';
		},
		'filesizeformat': function(value) {
			return 'T.readablizeBytes('+value+')';
		},
		'string': function(value){
			return 'T.toString('+value+')';
		},
		'upper': function(value){
			return 'T.toUpperCase('+value+')';
		},
		'lower': function(value){
			return 'T.toLowerCase('+value+')';
		},
		'encode': function(value,params){
			params = (params) ? T.params(params).join('') : "''"; 
			if(params == 'URI') {
				return '(encodeURI('+value+'))'; }
			else {
				return '(encodeURIComponent('+value+'))'; }
		},
		'escape': function(value,params) {
			params = (params) ? T.params(params).join('') : "''";
			return 'T.escape('+value+','+params+')';
		},
		'length': function(value){
			return '((typeof '+value+' !== \'undefined\') ? '+value+'.length : 0)';
		},
		'date': function(value,params) {
		// do *not* use T.fixParamQuotes here, regexps in formatDate
		// handle this. i.e. cannot format a date from a variable, must be string.
			params = (params || '').replace(/\\/g,'');
			return 'T.formatDate('+value+','+params+')';
		},
		'sort': function(value, params) {
		// {{ array | sort: PARAMS }}
		// eg. {{ array | sort: "title" }}
		// eg. {{ array | sort: "title" true }} => true == reverse
			params = (params) ? T.params(params).join(', ') : "''";
			return 'T.sort('+value+','+params+')';
		},
		'sort_reverse': function(value, params) {
			params = (params) ? T.params(params).join(', ') : "''";
			return 'T.sort_reverse('+value+','+params+')';
		}
	};
	
	// ==================
	// = Filter Methods =
	// ==================
	// These are the methods that apply filter logic
	// They may be of use outside out a template and data scope
	// ie. they must return a true value
	T.sort = function(items,key,reverse) {
		if (!items.sort || !items.length) {return '';}

		function sort(a,b) {
			var value_a = a[key],
				value_b = b[key];
							
			value_a = (typeof value_a === 'string') ? value_a.toLowerCase() : value_a;
			value_b = (typeof value_b === 'string') ? value_b.toLowerCase() : value_b;

			return ((value_a < value_b) ? -1 : ((value_a > value_b) ? 1 : 0));
		}
		
		items.sort(sort);
		
		reverse && items.reverse();

		return '';
	};
	T.sort_reverse = function(items,key) {
		return T.sort(items,key,true);
	};
	T.toUpperCase = function(value) {
		return T.toString(value).toUpperCase();
	};
	T.toLowerCase = function(value) {
		return T.toString(value).toLowerCase();
	};
	T.escape = function(value,type) {
		if(type === 'html') {
			return T.toString(value)
				.replace(/&(?=[^amp;])/g,'&amp;')
				.replace(/"/g,'&quot;')
				.replace(/'/g,'&#39;')
				.replace(/\</g,'&lt;')
				.replace(/\>/g,'&gt;'); } 
		else {
			return escape(value); }
	};
	T.readablizeBytes = function(bytes) {
		bytes = parseFloat(bytes);if(isNaN(bytes)){return 0;}
	 //http://www.elctech.com/snippets/convert-filesize-bytes-to-readable-string-in-javascript
	    var s = ['bytes', 'kb', 'MB', 'GB', 'TB', 'PB'];
	    var e = Math.floor(Math.log(bytes)/Math.log(1024));
	    return ((bytes/Math.pow(1024, Math.floor(e))).toFixed(2)+' '+s[e]).replace(/\.0{1,2}/,'');
	};
	T.pluralise = function(value,suffix_plural,suffix_singular) {
		value = (typeof value === 'string') ? [value] : value;
		suffix_plural = suffix_plural || 's';
		suffix_singular = suffix_singular || '';
		
		return (value && value.length > 1) ? suffix_plural : suffix_singular;
	};
	T.truncatewords = function(value, length, suffix){
		value = T.toString(value);
		value = T.stripHTMLTags(value);
		length = parseInt(length || 50,10);
		suffix = (suffix == null) ? ' ...' : suffix;// allow empty suffix
		var value_arr = value.match(/(.+?([^\-](?=\s|,|\-)))/g); // whitespace (instead of .split(' '))
		if(value_arr && length < value_arr.length) {
			value = value_arr.slice(0,length).join('') + suffix; }
		return value;
    };
	T.truncatesentences = function(value, length, suffix){
		value = T.toString(value);
		value = T.stripHTMLTags(value);
		length = parseInt(length || 2,10);
		suffix = (suffix == null) ? ' ...' : suffix;// allow empty suffix
		var value_arr = value.match(/(.+?)([\.\n\r\;\!\?])+(?=[\s])/g);
									//	Any set of characters followed by any of the following:
									//	. ! l ?
									//	and a space character is considered a sentence
									//	Older version:
									//	/(.+?)(?=[\.\n\r])+(\.(?=\s))/g)
		if(value_arr && length < value_arr.length) {
			value = value_arr.slice(0,length).join('') + suffix; }
		return value;
    };
	T.titlecase = function(value){
		value = T.toString(value);
	// summary: Converts a string into titlecase
	// from dojo dtl
		var last, title = "";
		for(var i = 0, current; i < value.length; i++){
			current = value.charAt(i);
			if(last == " " || last == "\n" || last == "\t" || !last){
				title += current.toUpperCase();
			}else{
				title += current.toLowerCase();
			}
			last = current;
		}
		return title;
	};
	T.stripHTMLTags = function(value,tags) {
		tags = (tags && typeof tags === 'string') ? tags.split(',') : tags;
		tags = (tags)?tags.join('|'):'\\w+';
		value = ''+value.replace(new RegExp('<\/?('+tags+'|\!\-\-)\s*(.*?)>','g'),'');// instead of /(\<.*?\>)/
		return T.trim(value);
	};
	T.trim = function(value) {
		return T.toString(value).replace(/ +/g,' ').replace(/\s+$/,'').replace(/^\s+/,'');
	};
	T.random = function(value) {
		return (value && value.constructor === Array)
					? value[ Math.floor(Math.random()* value.length) ] : '';
	};
	
	// ==================
	// = Helper methods =
	// ==================
	T.params = function(string) {
	//	Converts string to array. Good for making sense if user passed string or variable
	//	eg. "abc" def ghi 'jkl'	=> [ "abc", def, ghi, 'jkl' ]
	
		if(!string || string.constructor !== String){return [];}
		
		string = string.replace(/\\(["'])/mig,'$1');
		
		string = string.match(/(((["'])(.*?)(\3))|(?=[\s])*([\w\.\[\]\(\)]+))/gmi);
							//	first part is for explicit strings
							//	second is for variables
							//	allows valid javascript variable characters: . [ ] ( )					
		
		if(!string || !string.length){return [];}
		
		for (var i = string.length - 1; i >= 0; i--){
			string[i] = T.trim(string[i]); };
		
		return string;
		
	//	[^\.\(\)\[\]]
	//	(((["'])(.*?)(\3))|\b\w+)
	//	(((["'])(.*?)(\3))|\w+(?=\b[^\.\[\]]))
	//	(((["'])(.*?)(\3))|(?=[\s])*([\w\.\[\]\(\)]+))
	};
		
	T.toString = function(value) {
		if(value == null){return ''; }
		var val_str = value.toString();
		return (typeof value === 'string')
				? value 
				: (val_str != '[object Object]' && val_str.indexOf('[object Object]') == -1) 
					? val_str : '';
	};

	T.ObjectToArray = function(obj) { // used in Loop method, malakia
		var  r = [];
		for(var i in obj){
			r.push([i,obj[i]]);}
		return r;
	};
	T.inArray = function(item,array) {
		array = array.reverse();
		for (var i = array.length - 1; i >= 0; i--){
			if (item == array[i]){ return i; }
		};
		return -1;
	};
	T.formatDate = function(datestr,opts,loc) {//optimise
		var date;
				
		try {date = T.parseDateString(datestr);} catch(e){ return '';}	

		loc = loc || T.settings.locales.default_lang();
		opts = opts || '';
		
		var locale_vars = T.settings.locales.dates[loc],
			rules = [
			{
				re: /%d{1,2}/g,
				handler: function(bits) {
					var d = date.getDate().toString();
					if(d.length == 1 && bits.split('').length == 3) {
						return '0'+d; }
					return d;
				}
			},
			{
				re: /%m{1,2}/g,
				handler: function(bits) {
					var d = (date.getMonth() + 1).toString();
					if(d.length == 1 && bits.split('').length == 3) {
						return '0'+d; }
					return d;
				}
			},
			{
				re: /%y{1,2}/g,
				handler: function(bits) {
					var d = (date.getFullYear()).toString();
					if(bits.split('').length == 2 ) {
						return d.substring(2,4); }
					return d;
				}
			},
			{
				re: /%D{1,2}/g,
				handler: function(bits) {
					var d = date.getDay();
					if(bits.split('').length == 2) {
						return (locale_vars.days_abbr) ? locale_vars.days_abbr[d] : locale_vars.days[d].substr(0,3);  }
					return locale_vars.days[d];
				}
			},
			{
				re: /%S/g,
				handler: function(bits) {
					var d = date.getDate().toString();
					if ((d.length > 1 && d.match(/^[^1]1$/)) || d.match(/^1$/)) {return locale_vars.st;}
					else if (d.match(/^[^1]?2$/)){return locale_vars.nd;}
					else if (d.match(/^[^1]?3$/)){return locale_vars.rd;}
					else { return locale_vars.th; }
				}
			},
			{
				re: /%M{1,2}/g,
				handler: function(bits) {
					var d = date.getMonth();
					if(bits.split('').length == 2) {
						return (locale_vars.months_abbr) ? locale_vars.months_abbr[d] : locale_vars.months[d].substr(0,3);  }
					return locale_vars.months[d];
				}
			},
			{				
				re: /%ago(,(\d+)(,(.*))?)?/ig,
				handler: function(bits,a,max_days,b,otherwise) {
				//	console.warn(max_days,b,otherwise,arguments)
					var d = date,
						today = new Date(),
						ret = '',
						diff = Math.ceil((today.getTime()-date.getTime())/1000),		
						day_diff = Math.floor(diff / 86400);

					max_days = (max_days || 31);
					
					otherwise = (b && !otherwise.length) ? '' : otherwise || T.formatDate(datestr,'%dd/%mm/%yy');
	
					if ( isNaN(day_diff) || day_diff < 0  || day_diff >= max_days ){
						if(day_diff >= max_days) { return otherwise;  }
						return '';}

					return day_diff == 0 && ( // http://ejohn.org/files/pretty.js
							diff < 60 && locale_vars.ago.now ||
							diff < 120 && locale_vars.ago.minute ||
							diff < 3600 && locale_vars.ago.minutes(Math.floor( diff / 60 )) ||
							diff < 7200 && locale_vars.ago.hour ||
							diff < 86400 && locale_vars.ago.hours(Math.floor( diff / 3600 ))) ||
						day_diff == 1 && locale_vars.ago.yesterday ||
						day_diff < 7 && locale_vars.ago.days(day_diff) ||
						day_diff < 31 && locale_vars.ago.weeks(Math.ceil( day_diff / 7 ));
				}
			},
			{
				re: /%tp?/g,
				handler: function(bits) {
					var d_hr = date.getHours(),
						d_m = date.getMinutes(),
						d_s = date.getSeconds(),
						d_suff = (d_hr >= 12) ? locale_vars.hrs.pm : locale_vars.hrs.am,
						d_hr_12hr = ((d_hr > 12) ? d_hr - 12 : d_hr).toString() ;
						
					d_m = (d_m < 10) ? '0'+d_m : d_m;

					d_hr_12hr = (d_hr_12hr.length == 1 && d_hr < 12) ? '0'+d_hr_12hr : d_hr_12hr;

					if( bits.indexOf('p') == -1 ) { // 24hr
						return d_hr+':'+d_m;  } //+':'+d_s
					return d_hr_12hr+':'+d_m+' '+d_suff; //:'+d_s+'
				}
			}
		];
		
		rules.reverse();
		
		for (var i = rules.length - 1; i >= 0; i--){
			var rule = rules[i],
				re = rule.re,
				han = rule.handler;
			( re.exec(opts) && ( opts = opts.replace(re,han) ));
		};

		return opts;
	};
	T.inObjArray = function(item,key,array) {
		array = array.reverse();
		for (var i = array.length - 1; i >= 0; i--){
			if (item == array[i][key]){ return i; }
		};
		return -1;
	};
	T.cycle = function(values) {
	// summary: Given an array return each item successively
		
		var i = 0,
			values_string = values.join(''),
			existing_cycles = T.settings.__tmp.cycles = T.settings.__tmp.cycles || {};
		
		if(values_string in existing_cycles) {
			var cycle = existing_cycles[values_string],
				last_used =	cycle.last_used;
				
			if(last_used < cycle.values.length -1 ) {
				last_used++;
				i = last_used; }
				
			existing_cycles[values_string].last_used = i;	}
		
		else {
			existing_cycles[values_string] = {
				values: values,
				last_used: i }; 	}

		return existing_cycles[values_string].values[i];
	};

	T.revertLineBreaks = function(value) {
		///([\n\r])/g,'\\$1'
		return value.replace(/__nl__/g,'\n').replace(/\\/g,'');
	//	return value.replace(/__NLC__/gi,'\n').replace(/\\/g,'');
	};
	
	T.objectTree = function(obj) {
		var r = [];
		
		if(obj && obj.constructor === Object ) {
			r.push('<dl>');
			for(var i in obj){
				var item = obj[i];
				item.constructor !== Object && item.constructor !== Array
					&& r.push('<dt>'+i+'</dt><dd>'+T.escape(item,'html')+'</dd>')
					|| r.push('<dt>'+i+'</dt><dd>'+T.objectTree(item)+'</dd>')  ;
			};
			r.push('</dl>');  }
			
		else if ( obj && obj.constructor === Array && obj.length) {
			r.push('<ol>');
			for (var i = obj.reverse().length - 1; i >= 0; i--){
				var item = obj[i];
				item.constructor !== Object && item.constructor !== Array
					&& r.push('<li>'+T.escape(item,'html')+'</li>')
					|| r.push('<li>'+T.objectTree(item)+'</li>')  ;
			};
			r.push('</ol>'); }
		
		return r.join('');
	};
	
	T.extend = function() {
		// from jquery
		// copy reference to target object
		var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options;
		
		var _extend = this.extend;
					
		// Handle a deep copy situation
		if ( typeof target === "boolean" ) {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}

		// Handle case when target is a string or something (possible in deep copy)
		if ( typeof target !== "object" && typeof target !== 'function' )
			target = {};

		// extend jQuery itself if only one argument is passed
		if ( length == i ) {
			target = this;
			--i;
		}

		for ( ; i < length; i++ )
			// Only deal with non-null/undefined values
			if ( (options = arguments[ i ]) != null )
				// Extend the base object
				for ( var name in options ) {
					var src = target[ name ], copy = options[ name ];

					// Prevent never-ending loop
					if ( target === copy )
						continue;

					// Recurse if we're merging object values
					if ( deep && copy && typeof copy === "object"  )
						target[ name ] = _extend( deep, 
							// Never move original objects, clone them
							src || ( copy.length != null ? [ ] : { } )
						, copy );

					// Don't bring in undefined values
					else if ( copy !== undefined )
						target[ name ] = copy;

				}

		// Return the modified object
		return target;
	};
	
	// ==================
	// = Error Catching =
	// ==================
	T.data_error = function(data,data_string,out) {
		return '';
	};
	T.debug_data_error = function(data,data_string,out) {
		console && console.error(this);
		console && console.warn( data || data_string );
		console && console.error( out );
		return 'Data Error: '+ this.name + ': '+ this.message;
	};

	T.render_error = function(data,data_string,output) {
		return '';
	};
	T.debug_render_error = function(data,data_string,output) {
		console && console.error(this);
		console && console.warn( output );
		return 'Render Error: '+ this.name + ': '+ this.message;
	};

	// ============
	// = Settings =
	// ============
	(function(){ 
		T.settings = {
			__tmp: {},
			locales: {
				default_lang: function() {
					return 2057;
					//return ((typeof odSite !== 'undefined' && odSite.Locale) ? odSite.Locale : 2057)+'';
				},
				dates: {
					'2057': { // EN
						'st': 'st', // first 1st
						'nd': 'nd', // second 2nd
						'rd': 'rd', // third 3rd
						'th': 'th', // fourth 4th ...
						hrs: {
							'am': 'a.m.',
							'pm': 'p.m.'
						},
						months: 'January February March April May June July August September October November December'.split(' '),
						days: 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' '),
						ago: {
							minute: '1 minute ago',
							hour: '1 hour ago',
							now: 'just now',
							yesterday: 'yesterday',					
							minutes: function(v) {
								return v + ' minutes ago';
							},
							hours: function(v) {
								return v + ' hours ago';
							},
							weeks: function(v) {
								return v + ' weeks ago';
							},
							days: function(v) {
								return v + ' days ago';
							}
						}
					},
					'1032': { // GR
						'st': '', // first 1st
						'nd': '', // second 2nd
						'rd': '', // third 3rd
						'th': '', // fourth 4th ...
						hrs: {
							'am': 'π.μ.',
							'pm': 'μ.μ.'
						},
						months: 'Iανουαρίου Φεβρουαρίου Μαρτίου Απριλίου Μαϊου Ιουνίου Ιουλίου Αυγούστου Σεπτέμβρη Οκτώβρη Νοέμβρη Δεκέμβρη'.split(' '),
						months_abbr: 'Ιαν Φεβ Μαρ Απρ Μαη Ιουν Ιουλ Άυγ Σεπ Οκτ Νοε Δεκ'.split(' '),
						days: 'Κυριακή Δευτέρα Τρίτη Τετάρτη Πέμπτη Παρασκευή Σάββατο'.split(' '),
						days_abbr: 'Κυρ Δευ Τρ Τετ Πέμ Παρ Σάβ'.split(' '),
						ago: {
							minute: 'πριν ένα λεπτό',
							hour: 'πριν μια ώρα',
							now: 'μόλις τώρα',
							yesterday: 'χθες',					
							minutes: function(v) {
								return 'πριν '+v + ' λεπτά';
							},
							hours: function(v) {
								return 'πριν '+v + ' ώρες';
							},
							weeks: function(v) {
								var many = (parseInt(v,10) > 1) ? 'ες' : 'α';
								v = (parseInt(v,10) > 1) ? 'μία' : v;
								return 'πριν '+ v + ' βδομάδ'+many;
							},
							days: function(v) {
								return 'πριν '+v + ' μέρες';
							}
						}
					}
				}
			}
		};
	})();
	
	/* 'Magic' date parsing, by Simon Willison (6th October 2003)
	   http://simon.incutio.com/archive/2003/10/06/betterDateInput*/
	// minimise this/refactor
	(function() {
		/* Finds the index of the first occurence of item in the array, or -1 if not found */
		Array.prototype.indexOf = function(item) {
		    for (var i = 0; i < this.length; i++) {
		        if (this[i] == item) {
		            return i;
		        }
		    }
		    return -1;
		};
		/* Returns an array of items judged 'true' by the passed in test function */
		Array.prototype.filter = function(test) {
		    var matches = [];
		    for (var i = 0; i < this.length; i++) {
		        if (test(this[i])) {
		            matches[matches.length] = this[i];
		        }
		    }
		    return matches;
		};

		var monthNames = "January February March April May June July August September October November December".split(" ");
		var weekdayNames = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");

		/* Takes a string, returns the index of the month matching that string, throws
		   an error if 0 or more than 1 matches
		*/
		function parseMonth(month) {
		    var matches = monthNames.filter(function(item) { 
		        return new RegExp("^" + month, "i").test(item);
		    });
		    if (matches.length == 0) {
		        throw new Error("Invalid month string");
		    }
		    if (matches.length > 1) {
		        throw new Error("Ambiguous month");
		    }
		    return monthNames.indexOf(matches[0]);
		}
		/* Same as parseMonth but for days of the week */
		function parseWeekday(weekday) {
		    var matches = weekdayNames.filter(function(item) {
		        return new RegExp("^" + weekday, "i").test(item);
		    });
		    if (matches.length == 0) {
		        throw new Error("Invalid day string");
		    }
		    if (matches.length > 1) {
		        throw new Error("Ambiguous weekday");
		    }
		    return weekdayNames.indexOf(matches[0]);
		}

		/* Array of objects, each has 're', a regular expression and 'handler', a 
		   function for creating a date from something that matches the regular 
		   expression. Handlers may throw errors if string is unparseable. 
		*/
		var dateParsePatterns = [
		    // Today
		    {   re: /^tod/i,
		        handler: function() { 
		            return new Date();
		        } 
		    },
		    // Tomorrow
		    {   re: /^tom/i,
		        handler: function() {
		            var d = new Date(); 
		            d.setDate(d.getDate() + 1); 
		            return d;
		        }
		    },
		    // Yesterday
		    {   re: /^yes/i,
		        handler: function() {
		            var d = new Date();
		            d.setDate(d.getDate() - 1);
		            return d;
		        }
		    },
		    // 4th
		    {   re: /^(\d{1,2})(st|nd|rd|th)?$/i, 
		        handler: function(bits) {
		            var d = new Date();
		            d.setDate(parseInt(bits[1], 10));
		            return d;
		        }
		    },
		    // 4th Jan
		    {   re: /^(\d{1,2})(?:st|nd|rd|th)? (\w+)$/i, 
		        handler: function(bits) {
		            var d = new Date();
		            d.setDate(parseInt(bits[1], 10));
		            d.setMonth(parseMonth(bits[2]));
		            return d;
		        }
		    },
		    // 4th Jan 2003
		    {   re: /^(\d{1,2})(?:st|nd|rd|th)? (\w+),? (\d{4})$/i,
		        handler: function(bits) {
		            var d = new Date();
		            d.setDate(parseInt(bits[1], 10));
		            d.setMonth(parseMonth(bits[2]));
		            d.setYear(bits[3]);
		            return d;
		        }
		    },
		    // Jan 4th
		    {   re: /^(\w+) (\d{1,2})(?:st|nd|rd|th)?$/i, 
		        handler: function(bits) {
		            var d = new Date();
		            d.setDate(parseInt(bits[2], 10));
		            d.setMonth(parseMonth(bits[1]));
		            return d;
		        }
		    },
		    // Jan 4th 2003
		    {   re: /^(\w+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i,
		        handler: function(bits) {
		            var d = new Date();
		            d.setDate(parseInt(bits[2], 10));
		            d.setMonth(parseMonth(bits[1]));
		            d.setYear(bits[3]);
		            return d;
		        }
		    },
		    // next Tuesday - this is suspect due to weird meaning of "next"
		    {   re: /^next (\w+)$/i,
		        handler: function(bits) {
		            var d = new Date();
		            var day = d.getDay();
		            var newDay = parseWeekday(bits[1]);
		            var addDays = newDay - day;
		            if (newDay <= day) {
		                addDays += 7;
		            }
		            d.setDate(d.getDate() + addDays);
		            return d;
		        }
		    },
		    // last Tuesday
		    {   re: /^last (\w+)$/i,
		        handler: function(bits) {
		            throw new Error("Not yet implemented");
		        }
		    },
		    // dd/mm/yyyy
		    {   re: /(\d{1,2})\/(\d{1,2})\/(\d{4})(\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/,
		        handler: function(bits) {
					//console.error(bits)
		            var d = new Date();
		            d.setFullYear(bits[3]);
		            d.setMonth(parseInt(bits[2], 10) - 1); // Because months indexed from 0
		            d.setDate(parseInt(bits[1], 10));

					bits[5] && d.setHours(parseInt(bits[5],10));
					bits[6] && d.setMinutes(parseInt(bits[6],10));
					bits[7] && d.setSeconds(parseInt(bits[7],10));
		            return d;
		        }
		    },
		    // yyyy-mm-dd (ISO style)
		    {   re: /(\d{4})-(\d{1,2})-(\d{1,2})/,
		        handler: function(bits) { 
		            var d = new Date();
		            d.setYear(parseInt(bits[1],10));
		            d.setDate(parseInt(bits[3], 10));
		            d.setMonth(parseInt(bits[2], 10) - 1);
		            return d;
		        }
		    }
		];

		T.parseDateString = function parseDateString(s) {
		    for (var i = 0; i < dateParsePatterns.length; i++) {
		        var re = dateParsePatterns[i].re;
		        var handler = dateParsePatterns[i].handler;
		        var bits = re.exec(s);
		        if (bits) {
		            return handler(bits);
		        }
		    }
		    throw new Error("Invalid date string");
		};
	})();

	jQuery && (jQuery.fn.meelo = function(action,opts) {
		opts = (typeof action !== 'string' && !opts) ? action : opts;
		action = (typeof action === 'string') ? action : null;
		opts = opts || {};
		opts.text = opts.text || 'self';
		opts.name = opts.name || '';
		opts.data = opts.data || null;
	
		return this.each(function() {
			var $this = $(this),
				template_name = $this.data('meelo-template-name'),
				text = opts.text = (opts.text === 'self') ? this.innerHTML : opts.text,
				template = T.list[template_name];
				opts.dom = this;
				
			if(!template_name || !template) { // create new template
				template = new T(opts);
				$this.data('meelo-template-name', template.name ); }
			
			if(action === 'render') {
				template.retrieve(opts.data, function(rendered){
					$this.html(rendered);
				}); }

			else if (action === 'unload') {
				template.unload(); }
		});
	});

	
})();