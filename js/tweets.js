/**
  * Twitkut
  * A twitter application for Orkut
  * source: http://github.com/ankit/twitkut
  *
  * Copyright (c) 2010 Ankit Ahuja (http://ankitahuja.com)
  * Licensed under the MIT License.
**/

/* 
    Global vars 
    TODO: Use a proper data structure for storing all the data!
*/

// user's twitter id
var twitter_id = null;
// array containing all orkut friends' twitter id
var friends_twitterid = [];
var twitkut_friends = [];
var tweets_data = 1;
var friends_tweets_data = 1;
var viewer = 0;
var owner = 0;
var friends = [];
var last_tweet_time;
var hide_replies = 0;
var last_tweet = [];
var useOAuth = 0;
var signed_in = -1;

/* Initial function to call on document load */
var init = function() {
	prefetchData();
	gadgets.window.adjustHeight();
}

// update the settings UI
var makeSettings = function() {
	clearDiv("errorInSettings");
	clearDiv("info");
	if (isOwner())
	{
		if (twitter_id)
			document.getElementById('username').value = twitter_id;
		if (useOAuth)
			document.getElementById('useoauth').checked = true;
		if (hide_replies)
			document.getElementById('hidereplies').checked = true;
	}
}

// called when the 'Save settings' link is clicked in the settings tab
var saveSettings = function() {
	// validating Twitter ID
	twitter_id = document.getElementById("username").value;	
	if (twitter_id)
	{
		if (document.getElementById("hidereplies").checked)
			hide_replies = 1;
		else
			hide_replies = 0;
		if (document.getElementById("useoauth").checked)
			useOAuth = 1;
		else
			useOAuth = 0;
		storeSettings();
	}
	else
		raiseErrorInSettings("Enter a valid Twitter Id!");
}

// save the user settings persistently 
var storeSettings = function()
{
	var req = opensocial.newDataRequest();
	var twit_id = twitter_id;
    // only update settings if the user is the owner
	if (isOwner())
	{
		req.add(req.newUpdatePersonAppDataRequest("VIEWER","twitterid", twit_id));
		req.add(req.newUpdatePersonAppDataRequest("VIEWER","hidereplies", hide_replies ? "true" : "false"));
		req.add(req.newUpdatePersonAppDataRequest("VIEWER","useoauth", useOAuth ? "true" : "false"));
		req.add(req.newUpdatePersonAppDataRequest("VIEWER","signedin", signed_in ? "true" : "false"));
		req.send(onStoreSettings);
	}
}

// callback for request sent in storeSettings()
var onStoreSettings = function(data)
{
	raiseInfo("Settings saved successfully!");
	if (!useOAuth)
	{
		removeDiv('signin');
	}
	getTweets();
}

// display the loading spinner icon
var generateLoadingImage = function() {
	if(isOwner())
	{
		fillDiv("friends","<div class='loading'><img src='http://www.ankitahuja.com/apps/orkut/images/ajax-loader.gif' /></div>");
		fillDiv("friends_tweets_list","<div class='loading'><img src='http://www.ankitahuja.com/apps/orkut/images/ajax-loader.gif' /></div>");
	}
}

// Check if the user is the owner of profile
var isOwner = function() {
	try
	{
		if (owner.getId() == viewer.getId())
			return true;
		else
			return false;
	}
	catch(e) {
	    return false;
	}
}

// Make cached request
var makeCachedRequest = function(url, callback, params, refreshInterval) {
  var ts = new Date().getTime();
  var sep = "?";
  if (refreshInterval && refreshInterval > 0) {
    ts = Math.floor(ts / (refreshInterval * 1000));
  }
  if (url.indexOf("?") > -1) {
    sep = "&";
  }
  url = [ url, sep, "nocache=", ts ].join("");
  gadgets.io.makeRequest(url, callback, params);
}

// Store last posted activity in settings
var storeActivityInSettings = function() {
		var req = opensocial.newDataRequest();
		var last_tweet = tweets_data[0].created_at;
		if (isOwner())
		{
			req.add(req.newUpdatePersonAppDataRequest(opensocial.IdSpec.PersonId.VIEWER,"last_tweet_time",last_tweet));
			req.send(onStoreSettings);
		}
}

// load user settings like twitter id, useoauth, etc.
var loadSettings = function() {
	var req = opensocial.newDataRequest();
	var idspec = opensocial.newIdSpec({ "userId" : "OWNER"});
	var fields = ["twitterid","last_tweet_time","hidereplies","useoauth","signedin"];
	req.add(req.newFetchPersonAppDataRequest(idspec,fields),"userdata");
	req.send(onLoadSettings);
}

// callback for request send in loadSettings()
var onLoadSettings = function(response) {
	clearDiv("tweets");
	var userdata = response.get('userdata').getData();
	var data = userdata[owner.getId()];
	var twitid = null;
	if (data)
	{
		twitid = data['twitterid'];
		try
		{
			if (data['last_tweet_time'])
			{
				last_tweet_time = data['last_tweet_time'];
			}
			if (data['hidereplies'])
			{
				hide_replies = (data['hidereplies'] == "true") ? 1 : 0;
			}
			if (data['useoauth'])
			{
				useOAuth = (data['useoauth'] == "true") ? 1 : 0;
			}
			if (data['signedin'])
			{
				signed_in = (data['signedin'] == "true") ? 1 : 0;
			}
		}
		catch(e){}
	}
	if (twitid)
	{
		twitter_id = twitid;
		makeSettings();
		getTweets();
	}
	else
	{
	 	raiseError("Configure Twitkut by going to Settings");
	}
}

// fetch user's tweets from twitter by making a call to the twitter API / search API (depending upon if OAuth is enabled)
var getTweets = function() {
	clearDiv("tweets");
	clearDiv("errorInTweetsView");
	var params = {};
	var url = "http://search.twitter.com/search.json?q=from:" + twitter_id + "&rpp=20";
	params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
	params[gadgets.io.RequestParameters.REFRESH_INTERVAL] = 0;
	if (!useOAuth || !isOwner())
	{
		gadgets.io.makeRequest(url, storeTweets, params);
	}
	else
	{
	    params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
	    params[gadgets.io.RequestParameters.AUTHORIZATION] = gadgets.io.AuthorizationType.OAUTH;
		params[gadgets.io.RequestParameters.OAUTH_USE_TOKEN] = "always";
	    params[gadgets.io.RequestParameters.METHOD] = gadgets.io.MethodType.GET;
	 	url = "http://twitter.com/statuses/user_timeline.json";
	    params[gadgets.io.RequestParameters.OAUTH_SERVICE_NAME] = "twitter";
		gadgets.io.makeRequest(url, storeTweetsWithAuth, params);
	}
}

// callback for request sent in getTweets() ( if request is made using OAuth )
var storeTweetsWithAuth = function(response)
{
	if (response.oauthApprovalUrl)
	{
		signed_in = 0;
		raiseError("Go to Settings and sign in With Twitter. Or turn off OAuth.");
		if (!document.getElementById('signin'))
		{
			appendDiv('setting_form','<a id="signin" href="javascript:void(0);"><img src="http://ankitahuja.com/apps/orkut/images/signin_twitter.png" /></a>');
		}
 		makeSettings();
 		raiseInfo("Please Sign in with Twitter");
		var popup = shindig.oauth.popup({
		    destination: response.oauthApprovalUrl,
		    windowOptions: null,
		    onOpen: function() {  },
		    onClose: function() { getTweets(); }
	    });
		document.getElementById('signin').onclick = popup.createOpenerOnClick();	    
	}
	else if (response.data)
	{
		removeDiv('signin');
		signed_in = 1;
		raiseInfo("You're signed in using Twitter. Go to your tweets to post a tweet!");
		tweets_data = response.data;
		filterTweets();
		displayTweets();

		// Post tweet to user's activity stream
		if (isOwner())
		{
			if (last_tweet_time)
			{
				if (compareTime(last_tweet_time,tweets_data[0].created_at))
					postActivity();
			}
			else
				postActivity();
	 	}
	}
	else
	{
		raiseError("There was an error in OAuth authorization. Try and refresh page.");
	}
}

// callback for request sent in getTweets() to twitter search API ( when OAuth is disabled )
var storeTweets = function(response)
{
	var json;
	json = response.data;
	tweets_data = json.results;
	filterTweets();
	displayTweets();

	// post to user's activity stream
	if (isOwner())
	{
		if (last_tweet_time)
		{
			if (compareTime(last_tweet_time,tweets_data[0].created_at))
				postActivity();
		}
		else 
			postActivity();
	}
}

// get user's friends' tweets using twitter search API
var getFriendsTweets = function() {
	var url = "http://search.twitter.com/search.json?q=from:";
	var params =[];
	if (friends_twitterid.length == 0)
	{
		document.getElementById("friends_list").innerHTML = "None of your friends are using TwitKut!";
	}
	for (var i in friends_twitterid)
	{
		if (i != 0)
		{
			url += "+OR+from:";
		}
		url += friends_twitterid[i];
	}
	url += "&rpp=20";
	params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
	gadgets.io.makeRequest(url, storeFriendsTweets, params);
}

// callback for request sent in getFriendsTweets()
var storeFriendsTweets = function(json)
{
	friends_tweets_data = json.data.results;
	displayFriendsTweets();
}

// compare if two time values are equal. if time1 == time2, returns true
var compareTime = function(time1, time2)
{
	var ret_value = true;
	var words = new Array();
	var time = new Array();
	words = time1.split(" ");
	time = words[4].split(":");
	var m_no = MonthNumber(words[2]);
	var date1 = new Date(words[3], m_no, words[1], time[0], time[1], time[2]);

	words = time2.split(" ");
	time = words[4].split(":");
	m_no = MonthNumber(words[2]);
	date2 = new Date(words[3], m_no, words[1], time[0], time[1], time[2]);

	if (date1.getFullYear() == date2.getFullYear())
	{
		if (date1.getMonth() == date2.getMonth())
		{
			if (date1.getDate() == date2.getDate())
			{
				if (date1.getHours() == date2.getHours())
				{
					if (date1.getMinutes() == date2.getMinutes())
					{
						if (date1.getSeconds() == date2.getSeconds())
						{
							ret_value = false;
						}
					}
				}
			}
		}
	}
	return ret_value;
}

// send request to post activity to user's activity stream
var postActivity = function() {
	var title = ' tweeted ' + tweets_data[0].text;
	var params = [];
	params[opensocial.Activity.Field.TITLE] = title;
    var activity = opensocial.newActivity(params);
	opensocial.requestCreateActivity(activity, opensocial.CreateActivityPriority.HIGH, onPostActivity);
}

// callback for request sent in postActivity()
var onPostActivity = function(status)
{
	if (status.hadError())
	{
	}
	else
	{
		storeActivityInSettings();
	}
}

// fetch owner and viewer data
var prefetchData = function() {
	var req = opensocial.newDataRequest();
	req.add(req.newFetchPersonRequest(opensocial.IdSpec.PersonId.OWNER), 'owner');
	req.add(req.newFetchPersonRequest(opensocial.IdSpec.PersonId.VIEWER), 'viewer');
	req.send(onPrefetchData);
}

// callback for request in prefetchData()
var onPrefetchData = function(data) {
	owner = data.get('owner').getData();
	viewer = data.get('viewer').getData();
	if (isOwner())
	{
		createTabs();
	}
	generateLoadingImage();
	if (isOwner())
	{
		loadSettings();
		loadFriends();
	}
}

// filter tweets. i.e. if @replies are supposed to be hidden, hide them
var filterTweets = function() {
 	var j = 0;
 	var i = 0;
	if (hide_replies)
	{
		for (i = 0; i < tweets_data.length; i++)
		{
			var tweet = tweets_data[i].text;
			words = tweet.split(" ");
			if (words[0].charAt(0) != '@' || words[0].charAt(1) == " ")
			{
				tweets_data[j] = tweets_data[i];
				j++;
			}
		}
		if (j < i)
		{
			tweets_data = tweets_data.slice(0,j);
		}
	}
}

// check charaacter count in textarea used for posting tweet. accordingly, update text displaying char count
var checkCharacterNo = function() {
	var textarea = document.getElementById('update_text');
	var charcount = document.getElementById('char_remaining');
	charcount.innerHTML = 140 - textarea.value.length;
	if (textarea.value.length > 130)
		charcount.style.color = "red";
	else
		charcount.style.color = "#355B85";
}

// display user's tweets
var displayTweets = function() {
	clearDiv("tweets");
	var i = 0;
	if (tweets_data[0])
	{
		if (useOAuth && isOwner())
		{
			var img_url = tweets_data[0].user.profile_image_url;	
			var html = "<br/><h3 style='margin-bottom:5px'>what are you doing?";			
			html += "<span style='float:right;margin-right:85px;'><span id='char_remaining'>140</span>";
			html += "</h3><textarea onkeyup='checkCharacterNo();' id='update_text'style='width:90%' rows='3'></textarea>";
			html += "<p><a href='javascript:void(0);' onclick='sendUpdate();' title='Update your twitter status'><img src='http://ankitahuja.com/apps/orkut/images/update_bt.png' /></a></p>";
			appendDiv("tweets",html);
		}
		else
		{
			var img_url = tweets_data[0].profile_image_url;
		}
		var tweet_pic = "<a target='_blank' href='http://www.twitter.com/"+twitter_id+"' title='"+twitter_id+" on Twitter ' /><img src='"+img_url+"' height='50px' width='50px' /></a>";
	   	fillDiv("greet","<div class='user-img' >"+tweet_pic+"</div>");
	   	if (isOwner())
	   	{
            appendDiv("greet", "<div class='user'><h3><a target='_blank' href='http://www.twitter.com/" + twitter_id + "' title='" + twitter_id + " on Twitter'>Your</a> recent tweets</h3></div>");
	   	}
	   	else
	   	{
	   		appendDiv("greet","<div class='user'><h3><a target='_blank' href='http://www.twitter.com/" + twitter_id + "'title='" + twitter_id + " on Twitter'>" + twitter_id + "</a>'s recent tweets</h3></div>");
	   	}
	   	for (var i = 0; i < tweets_data.length; i++)
	    {
				parseTweet(i);
		}
		if (isOwner())
		{
			htmlout = "<br/><br/><p class='smalltext'>* Activity Stream will only be updated when you visit the application page.</p>"
			appendDiv("tweets",htmlout);
		}
	}
	else
	{
		if (isOwner())
			raiseError("Enter a valid Twitter Id! Please configure TwitKut properly by going to settings");
		else
			raiseError("Twitkut not configured properly!");
	}
}

// send OAuth request to post tweet
var sendUpdate = function(){
	var params = {};
	var url = "http://twitter.com/statuses/update.json";
	params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
	params[gadgets.io.RequestParameters.POST_DATA] = "status=" + document.getElementById("update_text").value;
    params[gadgets.io.RequestParameters.AUTHORIZATION] = gadgets.io.AuthorizationType.OAUTH;
	params[gadgets.io.RequestParameters.OAUTH_USE_TOKEN] = "always";
	params[gadgets.io.RequestParameters.METHOD] = gadgets.io.MethodType.POST;
	params[gadgets.io.RequestParameters.OAUTH_SERVICE_NAME] = "twitter";
	gadgets.io.makeRequest(url,onSendUpdate, params);
}

// callback for request in sendUpdate()
var onSendUpdate = function(response) {
	if (response.data)
	{
		// add the new tweet to the beginning of array
		tweets_data.unshift(response.data);
		filterTweets();
		displayTweets();
		// post the new tweet to the user's activity stream
		postActivity();
	}
	else if (response.oauthErrorText)
	{
		alert("There was an error: " + response.oauthErrorText);
	}
}

// display friends' tweets
var displayFriendsTweets = function()
{	
	clearDiv("friends_tweets_list");
	fillDiv("friends_tweets_list","<div class='greet'><h3>Friends' Tweets</div>");
	if (friends_tweets_data[0])
    {
    	for (var i = 0; i < friends_tweets_data.length; i++)
            parseFriendsTweet(i);
	}
}

// parse and display a user's tweet
var parseTweet = function(tweetno) {
	var tweet = tweets_data[tweetno].text;
	var words = new Array();
	var new_tweet = "";
	var RegexUrl = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
	words = tweet.split(" ");
	i = 0;
	while (words[i])
	{
		if (words[i].charAt(0) == '@')
		{
			new_tweet += "@" + "<a target='_blank' href='http://www.twitter.com/" + words[i].substring(1) + "' >" + words[i].substring(1) + "</a>" + " ";
		}
		else if (RegexUrl.test(words[i]))
		{
			new_tweet += "<a target='_blank' href='" + words[i] + "' >" + words[i] + "</a>" + " ";
		}
		else
		{
			new_tweet += words[i] + " ";
		}
		i++;
	}
	var sinceTime = prettyDate(tweets_data[tweetno].created_at);
	appendDiv("tweets", "<div class='tweet'><div class='text'>" + new_tweet + "</div><div class='since'><a target='_blank' href='http://www.twitter.com/" + twitter_id + "/statuses/" + tweets_data[tweetno].id + "'>" + sinceTime + "</a></div>");
}

// parse and display a friend's tweet
var parseFriendsTweet = function(tweetno) {
	var tweet = friends_tweets_data[tweetno].text;
	var words = new Array();
	var user = friends_tweets_data[tweetno].from_user;
	var new_tweet = "";
	var RegexUrl = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/ ;
	words = tweet.split(" ");
	i = 0;
	userimage = "<a target='_blank' href='http://www.twitter.com/" + user + "' title='" + user + "'><img src='" + friends_tweets_data[tweetno].profile_image_url + "' ></a> ";
	new_tweet = "<b><a target='_blank' href='http://www.twitter.com/" + user + "' title='" + user + "'>" + user + "</a></b> ";
	while(words[i])
	{
		if (words[i].charAt(0) == '@')
		{
			new_tweet += "@" + "<a target='_blank' href='http://www.twitter.com/" + words[i].substring(1) + "' >" + words[i].substring(1) + "</a>" + " ";
		}
		else if (RegexUrl.test(words[i]))
		{
			new_tweet += "<a target='_blank' href='" + words[i] + "' >" + words[i] + "</a>" + " ";
		}
		else
		{
			new_tweet += words[i] + " ";
		}
		i++;
	}
	var sinceTime = prettyDate(friends_tweets_data[tweetno].created_at);
	appendDiv("friends_tweets_list", "<div class='tweet'><span class='user-img'>" + userimage + "</span><div class='f_text'>" + new_tweet + "</div><div class='since'><a target='_blank' href='http://www.twitter.com/" + user + "/statuses/" + friends_tweets_data[tweetno].id + "'>" + sinceTime + "</a></div>");
}

// return month number for a short month name
var MonthNumber = function(month) {
	var mno = 0;
	switch (month)
	{
  		case "Jan": return 0;
  		case "Feb": return 1;
  		case "Mar": return 2;
  		case "Apr": return 3;
  		case "May": return 4;
  		case "Jun": return 5;
  		case "Jul": return 6;
  		case "Aug": return 7;
  		case "Sep": return 8;
  		case "Oct": return 9;
  		case "Nov": return 10;
  		case "Dec": return 11;
	}
	return null;
}

// switch tab
var changeSelectedTab = function() {
  if (document.getElementById('tabs_div_header')) {
    var tabHeaders = document.getElementById('tabs_div_header').rows[0].cells;
    for (var i in tabHeaders) {
      if (tabHeaders[i].className && tabHeaders[i].className.match(/tablib_selected/)) {
        if (tabHeaders[i].childNodes[0].className) {
          tabHeaders[i].childNodes[0].className = 'tablib_extension_left_selected';
        }
      }
      if (tabHeaders[i].className !== undefined && tabHeaders[i].className.match(/tablib_unselected/)) {
        if (tabHeaders[i].childNodes[0].className) {
          tabHeaders[i].childNodes[0].className = 'tablib_extension_left_unselected';
        }
      }
    }
  }
}

// display user's friends in friends tab
var fillFriends = function() {
	var params = {};
	var url;
	fillDiv("friends", "<div class='greet'><h3>Friends using Twitkut</h3></div>");
	if (twitkut_friends.length == 0)
	{
		appendDiv("friends", "<br/><h3>None of your friends are using Twitkut :(</h3>");
	}
	for (var i in twitkut_friends)
	{
		profile_url = twitkut_friends[i].getField(opensocial.Person.Field.PROFILE_URL);
		appendDiv("friends", "<div class='tweet'><div class='user-img'><a href='" + profile_url + "'><img src='" + twitkut_friends[i].getField(opensocial.Person.Field.THUMBNAIL_URL) + "'/></a></div><div class='text'> <a target='_blank' href='" + profile_url + "'>" + twitkut_friends[i].getDisplayName() + "</a> on Twitter: <b><a target='_blank' href='http://www.twitter.com/" + friends_twitterid[i] + "'>" + friends_twitterid[i]+"</a></b></div>");
 
		//	Getting the Owner's relationship with friend on Twitter (if OAuth is enabled);
/*
		if(useOAuth)
		{
			alert("getting data now!");
			params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
			params[gadgets.io.RequestParameters.REFRESH_INTERVAL] = 0;	
			url = "http://twitter.com/friendships/show.json?source_screen_name="+twitter_id+"&target_screen_name="+friends_twitterid[i];			gadgets.io.makeRequest(url,onGetRelationship, params);
		}

*/
		appendDiv("friends","</div><br/>");
	}

// not used yet
var onGetRelationship = function(response) {
		alert("Got into the callback!");
		/*
		if(response.data)
		{
			data = response.data;
			alert("Got some data!");
		}
		*/
	}
}

// get user's orkut friends
var loadFriends = function() {
	var params = {};
	var req = opensocial.newDataRequest();
    var idspec = opensocial.newIdSpec({ "userId" : "OWNER", "groupId" : "FRIENDS" });
	params[opensocial.DataRequest.PeopleRequestFields.MAX] = 100;
	params[opensocial.DataRequest.PeopleRequestFields.PROFILE_DETAILS] = [opensocial.Person.Field.PROFILE_URL];
	req.add(req.newFetchPeopleRequest(idspec,params), "owner_friends");
	req.add(req.newFetchPersonAppDataRequest(idspec,"twitterid"),"friends_data");
	req.send(onLoadFriends);
}

// callback for req in loadFriends()
var onLoadFriends = function(data) {
	var friends = data.get('owner_friends').getData();
	var friends_data = data.get('friends_data').getData();
	var num = 0;
	friends.each(function(person)
	{
		personData = friends_data[person.getId()];
		if (personData)
		{
			twitkut_friends[num] = person;
			friends_twitterid[num] = personData['twitterid'];
			num++;
		}
	});
	if (num > 0)
	{
		getFriendsTweets();
		fillFriends();
	}
	else
	{
		fillDiv("friends_tweets_list", "<div class='greet'><h3>Friends' Tweets</div>");
		appendDiv("friends_tweets_list", "<br/><h3>None of your friends are using Twitkut :| Tell them about it!</h3>");
		fillDiv("friends", "<div class='greet'><h3>Friends Using Twitkut</div>");
		appendDiv("friends", "<br/><h3>None of your friends are using Twitkut :| Tell them about it!</h3>");
	}
}

// fill DIV with html
var fillDiv = function(divname, htmlout) {
	document.getElementById(divname).innerHTML = htmlout;
}

// append html to DIV
var appendDiv = function(divname, htmlout) {
	document.getElementById(divname).innerHTML += htmlout;
}

// clear DIV's html
var clearDiv = function(divname) {
	document.getElementById(divname).innerHTML = "";
}

// create a new DIV
var createDiv = function(parent_name, child_name) {
	newdiv = document.createElement('div');
	newdiv.setAttribute('id', child_name);
	document.getElementById(parent_name).appendChild(newdiv);
}

// remove a DIV from DOM
var removeDiv = function(divname) {
	var el = document.getElementById(divname);
	if (el)
	{
		el.parentNode.removeChild(el);
	}
}

// clear text field
var resetTextField = function(field){
	document.getElementById(field).value = "";
}

// raise error in the settings tab
var raiseErrorInSettings = function(text) {
	fillDiv("errorInSettings", text);
}

var raiseError = function(text) {
	fillDiv("errorInTweetsView", text);
}

var raiseInfo = function(text) {
	fillDiv("info", text);
}

var toggleSignIn = function() {
	if (signed_in == 0 && !document.getElementById('signin'))
	{
		new_a = document.createElement('a');
		new_a.setAttribute('id','signin');
		new_a.setAttribute('href','javascript:void(0)');
		new_a.innerHTML = '<img src="http://ankitahuja.com/apps/orkut/images/signin_twitter.png" />';
		document.getElementById('setting_form').appendChild(new_a);	
	}
	else
		removeDiv('signin');
}