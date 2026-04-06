(function () {
  var ALL_EVACUATION_CENTERS = {
    "Bacolod": [
      { id: "bac-tac-gym", name: "Taculing Gymnasium",            coords: [10.6496, 122.9475], capacity: 45 },
      { id: "bac-man-crt", name: "Mandalagan Covered Court",       coords: [10.6983, 122.9611], capacity: 62 },
      { id: "bac-b30-hal", name: "Barangay 30 Multi-Purpose Hall", coords: [10.6698, 122.9621], capacity: 58 }
    ],
    "Hinigaran": [
      { id: "hin-evac-ctr", name: "Hinigaran Disaster Evacuation Center", coords: [10.2678, 122.8502], capacity: 150 },
      { id: "hin-pub-plz",  name: "Hinigaran Public Plaza Gym",           coords: [10.2694, 122.8485], capacity: 90  },
      { id: "hin-esp-hall", name: "Esperanza Multi-Purpose Hall",         coords: [10.2541, 122.8612], capacity: 40  }
    ],
    "Bago City": [
      { id: "bag-com-ctr", name: "Bago City Community Center", coords: [10.5385, 122.8408], capacity: 200 }
    ],
    "Iloilo City": [
      { id: "ilo-sooc-evac",    name: "Regional Evacuation Center - Barangay Sooc",                       coords: [10.7100, 122.5450], capacity: 500 },
      { id: "ilo-molo-multi",   name: "Evacuation / Multi-Purpose Hall - Barangay San Juan (Molo)",       coords: [10.7090, 122.5545], capacity: 200 },
      { id: "ilo-arevalo-hall", name: "Covered Court Evacuation Site - Barangay Sto. Nino Sur (Arevalo)", coords: [10.7080, 122.5440], capacity: 180 }
    ]
  };

  window.ALL_EVACUATION_CENTERS = ALL_EVACUATION_CENTERS;

  function getAllCentersFlat() {
    var flat = [];
    Object.keys(ALL_EVACUATION_CENTERS).forEach(function (city) {
      ALL_EVACUATION_CENTERS[city].forEach(function (c) { flat.push(c); });
    });
    return flat;
  }

  function haversineKm(a, b) {
    var R = 6371, toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(b[0]-a[0]), dLng = toRad(b[1]-a[1]);
    var lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.asin(Math.sqrt(h));
  }

  function getNearestEvacuationCenters(userCoords, limit) {
    limit = limit || 5;
    return getAllCentersFlat()
      .map(function (c) { return { center: c, dist: haversineKm(userCoords, c.coords) }; })
      .sort(function (a, b) { return a.dist - b.dist; })
      .slice(0, limit)
      .map(function (x) { return x.center; });
  }

  window.EVACUATION_CENTERS = ALL_EVACUATION_CENTERS["Bacolod"];
  window._getAllCentersFlat = getAllCentersFlat;
  window._getNearestEvacuationCenters = getNearestEvacuationCenters;

  var DEFAULT_USER_LOCATION = [10.6765, 122.9509];
  var offlineMode = false;
  var holdInterval = null, holdTimeout = null, startTime = 0;
  var sosReadyToConfirm = false, sosSent = false, sosCooldownInterval = null;
  var SOS_COOLDOWN_SECONDS = 120, SOS_DAILY_LIMIT = 3, SOS_LIMITS_ENABLED = true;

  function showToast(msg) {
    var t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.style.display = "block";
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () { t.style.display = "none"; }, 2400);
  }

  function isMobileDevice() { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""); }
  function isOfflineContext() { return offlineMode || !navigator.onLine; }

  function saveLastKnownLocation(coords) {
    localStorage.setItem("handavisLastKnownLocation", JSON.stringify({ lat: coords[0], lng: coords[1], savedAt: Date.now() }));
  }
  function getLastKnownLocation() {
    try {
      var s = JSON.parse(localStorage.getItem("handavisLastKnownLocation") || "null");
      if (s && typeof s.lat === "number" && typeof s.lng === "number") return [s.lat, s.lng];
    } catch (e) {}
    return null;
  }

  function getBearingDirection(from, to) {
    var lat1=from[0]*Math.PI/180, lon1=from[1]*Math.PI/180, lat2=to[0]*Math.PI/180, lon2=to[1]*Math.PI/180;
    var y=Math.sin(lon2-lon1)*Math.cos(lat2), x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1);
    var b=(Math.atan2(y,x)*180/Math.PI+360)%360;
    return ["north","north-east","east","south-east","south","south-west","west","north-west"][Math.round(b/45)%8];
  }

  function getNearestEvacuationCenter(userLocation) {
    return getAllCentersFlat().map(function (c) {
      var d = haversineKm(userLocation, c.coords);
      return { name:c.name, coords:c.coords, capacity:c.capacity, distanceKm:d,
               travelMinutes:Math.max(3,Math.round(d*4)), direction:getBearingDirection(userLocation,c.coords) };
    }).sort(function (a,b) { return a.distanceKm-b.distanceKm; })[0];
  }

  function updateEvacuationRecommendationUI(rec, src) {
    var g = function (id) { return document.getElementById(id); };
    if (g("evacCenterName"))         g("evacCenterName").textContent = rec.name;
    if (g("evacCenterMeta"))         g("evacCenterMeta").textContent = "Distance: "+rec.distanceKm.toFixed(1)+" km · Capacity: "+rec.capacity+"% · Travel: "+rec.travelMinutes+" mins";
    if (g("routeRecommendationText")) g("routeRecommendationText").textContent = src+": Head "+rec.direction+" toward "+rec.name+". Keep to main roads.";
    if (g("offlineRouteTitle"))      g("offlineRouteTitle").textContent = isOfflineContext() ? "Offline Routes" : "Routes";
    if (g("offlineRouteMeta"))       g("offlineRouteMeta").textContent = "Saved: "+rec.name+" · "+rec.distanceKm.toFixed(1)+" km · "+rec.travelMinutes+" mins · "+src;
  }

  function hydrateSavedRouteRecommendation() {
    try {
      var s = JSON.parse(localStorage.getItem("handavisRouteRecommendation") || "null");
      if (s && s.centerName) updateEvacuationRecommendationUI({ name:s.centerName, distanceKm:s.distanceKm, capacity:s.capacity, travelMinutes:s.travelMinutes, direction:s.direction }, s.sourceLabel||"Last saved");
    } catch (e) {}
  }

  function getCurrentLocationForRouting() {
    return new Promise(function (resolve) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            var c = [pos.coords.latitude, pos.coords.longitude];
            saveLastKnownLocation(c);
            resolve({ coords:c, sourceLabel: isOfflineContext() ? "Offline live location" : "Live location" });
          },
          function () {
            var fb = getLastKnownLocation() || DEFAULT_USER_LOCATION;
            resolve({ coords:fb, sourceLabel: getLastKnownLocation() ? "Last known location" : "Saved default location" });
          },
          { enableHighAccuracy:true, timeout: isOfflineContext()?2500:4500, maximumAge: isOfflineContext()?600000:120000 }
        );
      } else {
        var fb = getLastKnownLocation() || DEFAULT_USER_LOCATION;
        resolve({ coords:fb, sourceLabel:"Saved default location" });
      }
    });
  }

  function buildInstantRouteRecommendation() {
    return getCurrentLocationForRouting().then(function (loc) {
      var nearest = getNearestEvacuationCenter(loc.coords);
      var rec = { centerName:nearest.name, distanceKm:nearest.distanceKm, capacity:nearest.capacity,
                  travelMinutes:nearest.travelMinutes, direction:nearest.direction,
                  sourceLabel:loc.sourceLabel, userCoords:loc.coords, centerCoords:nearest.coords, savedAt:Date.now() };
      updateEvacuationRecommendationUI(nearest, loc.sourceLabel);
      localStorage.setItem("handavisRouteRecommendation", JSON.stringify(rec));
      return rec;
    });
  }

  function showEvacuationRoute() {
    buildInstantRouteRecommendation().then(function () {
      if (isMobileDevice() && isOfflineContext()) { showToast("Offline mobile route recommendation is ready."); return; }
      showToast("Opening live map route view...");
      window.location.href = "user_live_map.php";
    });
  }

  function getTodayKey() { var n=new Date(); return n.getFullYear()+"-"+(n.getMonth()+1)+"-"+n.getDate(); }
  function getSOSData() {
    var s=JSON.parse(localStorage.getItem("handavisSOSData")||"{}"), k=getTodayKey();
    if (s.day!==k) return {day:k,count:0,cooldownUntil:0};
    return {day:k,count:s.count||0,cooldownUntil:s.cooldownUntil||0};
  }
  function saveSOSData(d) { localStorage.setItem("handavisSOSData", JSON.stringify(d)); }
  function updateSOSStatus(msg) { var e=document.getElementById("sosStatusText"); if(e) e.textContent=msg; }
  function disableSOSButtonState(msg) { var b=document.getElementById("sosBtn"); if(b) b.disabled=true;  updateSOSStatus(msg); }
  function enableSOSButtonState(msg)  { var b=document.getElementById("sosBtn"); if(b) b.disabled=false; updateSOSStatus(msg); }

  function startCooldownTimer() {
    if (!SOS_LIMITS_ENABLED) return;
    clearInterval(sosCooldownInterval);
    sosCooldownInterval = setInterval(function () {
      var d=getSOSData(), now=Date.now();
      if (now>=d.cooldownUntil) {
        clearInterval(sosCooldownInterval); resetSOSButtonFully();
        if (d.count>=SOS_DAILY_LIMIT) disableSOSButtonState("Daily SOS limit reached ("+SOS_DAILY_LIMIT+"/day). Try again tomorrow.");
        else enableSOSButtonState("Nearby responders and barangay officials will be notified.");
        return;
      }
      var rem=Math.ceil((d.cooldownUntil-now)/1000);
      var mins=String(Math.floor(rem/60)).padStart(2,"0"), secs=String(rem%60).padStart(2,"0");
      disableSOSButtonState("SOS cooldown active. Available again in "+mins+":"+secs+".");
      document.getElementById("sosLabel").textContent="COOLDOWN";
      document.getElementById("sosTimer").textContent=mins+":"+secs;
    }, 250);
  }

  function checkSOSAvailability() {
    if (!SOS_LIMITS_ENABLED) { enableSOSButtonState("Nearby responders and barangay officials will be notified."); return true; }
    var d=getSOSData(), now=Date.now();
    if (d.count>=SOS_DAILY_LIMIT) { disableSOSButtonState("Daily SOS limit reached ("+SOS_DAILY_LIMIT+"/day). Try again tomorrow."); return false; }
    if (now<d.cooldownUntil) { startCooldownTimer(); return false; }
    enableSOSButtonState("Nearby responders and barangay officials will be notified.");
    return true;
  }

  function updateSOSProgress() {
    var elapsed=Date.now()-startTime, progress=Math.min(elapsed/5000,1);
    var sr={r:15,g:23,b:42}, er={r:220,g:38,b:38};
    var r=Math.round(sr.r+(er.r-sr.r)*progress), g=Math.round(sr.g+(er.g-sr.g)*progress), b=Math.round(sr.b+(er.b-sr.b)*progress);
    var btn=document.getElementById("sosBtn"), timer=document.getElementById("sosTimer");
    if (!btn||!timer) return;
    btn.style.background="linear-gradient(180deg,rgb("+r+","+g+","+b+") 0%,rgb("+Math.max(r-30,0)+","+Math.max(g-20,0)+","+Math.max(b-20,0)+") 100%)";
    timer.textContent=Math.max(0,(5-elapsed/1000)).toFixed(1);
    if (progress>=1) readySOSConfirm();
  }

  function startSOSHold() {
    var btn=document.getElementById("sosBtn"), reason=(document.getElementById("sosReason")||{}).value;
    if (!btn||btn.disabled||sosSent||sosReadyToConfirm) return;
    if (!reason) { showToast("Please select an emergency reason first."); return; }
    if (!checkSOSAvailability()) return;
    clearSOSHold(); startTime=Date.now();
    document.getElementById("sosLabel").textContent="HOLDING...";
    document.getElementById("sosTimer").textContent="5.0";
    holdInterval=setInterval(updateSOSProgress,50);
    holdTimeout=setTimeout(readySOSConfirm,5000);
  }
  function clearSOSHold() {
    if (holdInterval) { clearInterval(holdInterval); holdInterval=null; }
    if (holdTimeout)  { clearTimeout(holdTimeout);   holdTimeout=null;  }
  }
  function resetSOSButtonVisual() {
    var btn=document.getElementById("sosBtn"); if (!btn) return;
    btn.style.background="linear-gradient(180deg,#0F172A 0%,#0F172A 100%)";
    btn.classList.remove("done");
    document.getElementById("sosLabel").textContent="HOLD SOS";
    document.getElementById("sosTimer").textContent="5";
  }
  function resetSOSButton() { if (sosSent||sosReadyToConfirm) return; clearSOSHold(); resetSOSButtonVisual(); }
  function resetSOSButtonFully() {
    sosReadyToConfirm=false; sosSent=false; clearSOSHold(); resetSOSButtonVisual();
    document.getElementById("sosConfirmBox").style.display="none";
    document.getElementById("confirmSOSBtn").disabled=false;
    document.getElementById("cancelSOSBtn").disabled=false;
  }
  function readySOSConfirm() {
    if (sosSent||sosReadyToConfirm) return;
    sosReadyToConfirm=true; clearSOSHold();
    var btn=document.getElementById("sosBtn"); btn.classList.add("done");
    document.getElementById("sosLabel").textContent="READY";
    document.getElementById("sosTimer").textContent="!";
    document.getElementById("sosConfirmBox").style.display="block";
  }

  function sendSOS() {
    var reason=document.getElementById("sosReason").value;
    if (!reason) { showToast("Please select an emergency reason."); return; }
    var fb=window.USER_REGISTERED_BARANGAY||window.USER_REGISTERED_TOWN||"";
    var fbId=Number(window.USER_REGISTERED_BARANGAY_ID||fb), hasId=Number.isFinite(fbId)&&fbId>0;
    function post(payload) {
      fetch("process/user_send_sos.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
        .then(function(r){return r.json();})
        .then(function(d){
          if (d.status==="success") showToast(typeof d.sent_count==="number"?"SOS sent to "+d.sent_count+" contact(s).":"SOS sent.");
          else showToast("Failed: "+(d.message||"Unable to send SOS."));
        }).catch(function(){showToast("Failed to send SOS.");});
    }

    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
      var fallbackPayload={reason:reason,barangay:fb};
      if(hasId) fallbackPayload.barangay_id=fbId;
      updateSOSStatus("SOS is sending without live GPS location. Enable browser location access for more accurate rescue routing.");
      post(fallbackPayload);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos){
        var p={reason:reason,lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6)),barangay:fb};
        if(hasId) p.barangay_id=fbId;
        updateSOSStatus("SOS is sending with live GPS location attached.");
        post(p);
      },
      function(){
        var p={reason:reason,barangay:fb};
        if(hasId) p.barangay_id=fbId;
        updateSOSStatus("SOS is sending without live GPS location. Please allow location access if possible.");
        post(p);
      },
      {enableHighAccuracy:true,timeout:5000,maximumAge:60000}
    );
  }

  function confirmSOS() {
    if (sosSent) return;
    if (SOS_LIMITS_ENABLED){var d=getSOSData();d.count++;d.cooldownUntil=Date.now()+(SOS_COOLDOWN_SECONDS*1000);saveSOSData(d);}
    sosSent=true;
    document.getElementById("sosLabel").textContent="SOS SENT";
    document.getElementById("sosTimer").textContent="✓";
    document.getElementById("confirmSOSBtn").disabled=true;
    document.getElementById("cancelSOSBtn").disabled=true;
    sendSOS(); startCooldownTimer();
  }
  function cancelSOS() {
    resetSOSButtonFully();
    if (!SOS_LIMITS_ENABLED){enableSOSButtonState("Nearby responders and barangay officials will be notified.");return;}
    if (getSOSData().count>=SOS_DAILY_LIMIT) disableSOSButtonState("Daily SOS limit reached ("+SOS_DAILY_LIMIT+"/day). Try again tomorrow.");
    else enableSOSButtonState("Nearby responders and barangay officials will be notified.");
  }
  function bindSOSPressEvents() {
    var btn=document.getElementById("sosBtn"); if (!btn) return;
    ["mousedown","touchstart","pointerdown"].forEach(function(e){btn.addEventListener(e,function(ev){ev.preventDefault();startSOSHold();},{passive:false});});
    ["mouseup","mouseleave","touchend","touchcancel","pointerup","pointercancel"].forEach(function(e){btn.addEventListener(e,function(){resetSOSButton();});});
    btn.addEventListener("click",function(e){
      e.preventDefault(); if(sosSent||sosReadyToConfirm)return;
      if(!(document.getElementById("sosReason")||{}).value){showToast("Please select an emergency reason first.");return;}
      if(!checkSOSAvailability())return; readySOSConfirm();
    });
    document.addEventListener("mouseup",resetSOSButton);
    document.addEventListener("pointerup",resetSOSButton);
  }

  window.showToast=showToast;
  window.showEvacuationRoute=showEvacuationRoute;

  document.addEventListener("DOMContentLoaded",function(){
    if (typeof window.loadTheme==="function") window.loadTheme();
    var cb=document.getElementById("confirmSOSBtn"), xb=document.getElementById("cancelSOSBtn");
    if(cb) cb.addEventListener("click",confirmSOS);
    if(xb) xb.addEventListener("click",cancelSOS);
    hydrateSavedRouteRecommendation();
    bindSOSPressEvents();
    checkSOSAvailability();
  });
})();

/* =============================================================
   CHECKLIST + PREP SCORE
   ============================================================= */
(function () {
  var STORAGE_KEY = "handavisChecklist";
  function saveChecklist() {
    var s={};
    document.querySelectorAll(".checklist-item").forEach(function(item){
      var k=item.dataset.key,cb=item.querySelector(".checklist-check");
      if(k&&cb) s[k]=cb.checked;
    });
    localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
  }
  function loadChecklist() {
    try{
      var s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      document.querySelectorAll(".checklist-item").forEach(function(item){
        var k=item.dataset.key,cb=item.querySelector(".checklist-check");
        if(k&&cb&&s[k]) cb.checked=true;
      });
    }catch(e){}
  }
  function updatePrepScore() {
    var items=document.querySelectorAll(".checklist-check"),checked=0;
    items.forEach(function(cb){if(cb.checked)checked++;});
    var total=items.length,pct=total>0?Math.round((checked/total)*100):0;
    var pctEl=document.getElementById("prepScorePct"),barEl=document.getElementById("prepScoreBar"),
        subEl=document.getElementById("prepScoreSub"),ov=document.getElementById("prepOverviewPct");
    var tier=pct>=88?{p:"pct-great",b:"bar-great"}:pct>=55?{p:"pct-good",b:"bar-good"}:pct>=30?{p:"pct-mid",b:"bar-mid"}:{p:"pct-low",b:""};
    if(pctEl){pctEl.textContent=pct+"%";pctEl.className="prep-score-pct "+tier.p;}
    if(barEl){barEl.style.width=pct+"%";barEl.className="prep-score-bar "+tier.b;}
    if(subEl) subEl.textContent=pct===0?"Start building your emergency readiness now":pct===100?"Your household is fully prepared. Stay alert.":pct>=75?"Almost there — "+(total-checked)+" item(s) remaining":pct>=50?"Good progress — keep completing your checklist":"You've completed "+checked+" of "+total+" preparedness items";
    if(ov) ov.textContent=pct+"%";
    saveChecklist();
  }
  document.addEventListener("DOMContentLoaded",function(){loadChecklist();updatePrepScore();});
  window.updatePrepScore=updatePrepScore;
})();

/* =============================================================
   SCENARIO SIMULATION + ROUTE & ACTION HUB
   ============================================================= */
(function () {

  function setText(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

  var state={
    scenario:"flood",location:"bacolod",severity:"high",time:"now",
    expanded:{impact:false,action:false},
    userPosition:null,userLocationLabel:null,
    lastRoute:null,routeBusy:false
  };

  var severityLabels={low:"Low",moderate:"Moderate",high:"High",critical:"Critical"};
  var timeLabels={now:"Now","6h":"Next 6 Hours","12h":"Next 12 Hours","24h":"Next 24 Hours"};
  var scenarioThemes={flood:"95,216,255",fire:"255,140,92",storm:"170,163,255",roadblock:"255,198,79",quake:"210,170,140",medical:"95,222,160"};
  var severityThemes={low:"85,214,118",moderate:"255,193,79",high:"255,144,77",critical:"255,84,84"};

  var locations={
    bacolod:{
      label:"Bacolod City",center:[10.6766,122.9511],
      floodArea:"Tangub, Mandalagan, Taculing, and nearby low-lying drainage zones",
      fireArea:"dense roadside commercial strips, market-side stalls, and warehouse-adjacent blocks",
      stormArea:"coastal barangays, exposed highways, and open drainage corridors",
      safePlaces:[
        {id:"bcgc",  name:"Bacolod City Government Center",                       address:"Circumferential Rd, Brgy. Villamonte, Bacolod City",note:"Primary city government and response coordination point.",                          kind:"command", priority:{flood:1,fire:2,storm:1,roadblock:1,quake:2,medical:2},query:"Bacolod City Government Center, Villamonte, Bacolod City, Philippines"},
        {id:"clmmrh",name:"Corazon Locsin Montelibano Memorial Regional Hospital",address:"Lacson St, Bacolod City",                          note:"Best for urgent medical referral, smoke inhalation, burns, and flood-related trauma.",kind:"medical", priority:{flood:3,fire:1,storm:3,roadblock:3,quake:1,medical:1},query:"Corazon Locsin Montelibano Memorial Regional Hospital, Bacolod City, Philippines"},
        {id:"panaad",name:"Panaad Park and Stadium",                               address:"Brgy. Mansilingan, Bacolod City",                  note:"Large open public complex useful for staging and relief distribution.",             kind:"open",    priority:{flood:2,fire:1,storm:2,roadblock:2,quake:3,medical:3},query:"Panaad Park and Stadium, Bacolod City, Philippines"}
      ],
      contacts:[
        {name:"Bacolod DRRMO Hotline",number:"(034) 432-3871",call:"0344323871",detail:"24/7 city DRRMO hotline."},
        {name:"Bacolod DRRMO Mobile", number:"0930 243 4706", call:"+639302434706",sms:"+639302434706",detail:"City DRRMO hotline cp number."},
        {name:"National Emergency Hotline",number:"911",call:"911",detail:"Nationwide emergency dispatch."},
        {name:"Philippine Red Cross",number:"143",call:"143",detail:"National rescue and ambulance hotline."}
      ]
    },
    iloilo:{
      label:"Iloilo City",center:[10.7202,122.5621],
      floodArea:"Molo, Jaro, La Paz, and river-adjacent roads",
      fireArea:"dense commercial strips, market-side blocks, and warehouse corridors",
      stormArea:"coastal barangays, open arterial roads, and low-drainage routes",
      safePlaces:[
        {id:"icare",         name:"Iloilo CDRRMO Operations Center",address:"Gaisano ICARE, Mandurriao, Iloilo City", note:"Official Iloilo City DRRMO support point.",kind:"command",   priority:{flood:1,fire:2,storm:1,roadblock:1,quake:2,medical:2},query:"Gaisano ICARE, Mandurriao, Iloilo City, Philippines"},
        {id:"wvmc",          name:"Western Visayas Medical Center",  address:"Q. Abeto St, Mandurriao, Iloilo City", note:"Major medical referral center.",           kind:"medical",   priority:{flood:3,fire:1,storm:3,roadblock:3,quake:1,medical:1},query:"Western Visayas Medical Center, Iloilo City, Philippines"},
        {id:"cityhalliloilo",name:"Iloilo City Hall",                address:"Plaza Libertad, Iloilo City",           note:"Central public assistance point.",         kind:"government",priority:{flood:2,fire:2,storm:2,roadblock:1,quake:2,medical:2},query:"Iloilo City Hall, Iloilo City, Philippines"}
      ],
      contacts:[
        {name:"Iloilo City Operations Center",number:"0919 066 2333",call:"+639190662333",sms:"+639190662333",detail:"Official Iloilo City Operations Center hotline."},
        {name:"ICER / USAR",                  number:"0919 066 1554",call:"+639190661554",sms:"+639190661554",detail:"Iloilo City Emergency Response."},
        {name:"BFP Search and Rescue",        number:"(033) 337-3011",call:"0333373011",detail:"Iloilo City BFP search and rescue."},
        {name:"National Emergency Hotline",   number:"911",call:"911",detail:"Nationwide emergency dispatch."}
      ]
    },
    capiz:{
      label:"Roxas / Capiz",center:[11.5850,122.7513],
      floodArea:"riverbanks, low bridges, and low-lying residential roads",
      fireArea:"dense settlement rows, port-adjacent stores, and public market blocks",
      stormArea:"coastal communities, fish port approaches, and exposed road sections",
      safePlaces:[
        {id:"roxascityhall",name:"Roxas City Hall",                   address:"Arnaldo Boulevard, Roxas City, Capiz",note:"Main city government landmark.",kind:"government",priority:{flood:2,fire:2,storm:2,roadblock:1,quake:2,medical:2},query:"Roxas City Hall, Roxas City, Capiz, Philippines"},
        {id:"rmph",         name:"Roxas Memorial Provincial Hospital",address:"Roxas Ave, Roxas City, Capiz",       note:"Medical referral center.",       kind:"medical",   priority:{flood:3,fire:1,storm:3,roadblock:3,quake:1,medical:1},query:"Roxas Memorial Provincial Hospital, Roxas City, Capiz, Philippines"},
        {id:"villareal",    name:"Villareal Stadium",                  address:"Roxas Ave, Roxas City, Capiz",       note:"Large open public space.",        kind:"open",      priority:{flood:1,fire:1,storm:1,roadblock:2,quake:3,medical:3},query:"Villareal Stadium, Roxas City, Capiz, Philippines"}
      ],
      contacts:[
        {name:"Roxas City CERT Landline",number:"(036) 522-7878",call:"0365227878",detail:"Official Roxas City CERT line."},
        {name:"Roxas City CERT Globe",   number:"0917 306 6741", call:"+639173066741",sms:"+639173066741",detail:"Official Roxas City CERT mobile."},
        {name:"Roxas City CERT Smart",   number:"0912 472 2669", call:"+639124722669",sms:"+639124722669",detail:"Official Roxas City CERT mobile."},
        {name:"National Emergency Hotline",number:"911",call:"911",detail:"Nationwide emergency dispatch."}
      ]
    },
    antique:{
      label:"Antique Coast",center:[10.7446,121.9410],
      floodArea:"coastal lowlands, river mouths, and overflow-prone access roads",
      fireArea:"closely packed homes, roadside shops, and fishing-port service strips",
      stormArea:"coastal barangays, exposed sea-facing roads, and hillside edge routes",
      safePlaces:[
        {id:"sjhall", name:"San Jose de Buenavista Municipal Hall",  address:"San Jose de Buenavista, Antique",note:"Main municipal government landmark.", kind:"government",priority:{flood:2,fire:2,storm:2,roadblock:1,quake:2,medical:2},query:"San Jose de Buenavista Municipal Hall, Antique, Philippines"},
        {id:"angel",  name:"Angel Salazar Memorial General Hospital",address:"San Jose de Buenavista, Antique",note:"Medical referral point.",              kind:"medical",   priority:{flood:3,fire:1,storm:3,roadblock:3,quake:1,medical:1},query:"Angel Salazar Memorial General Hospital, San Jose de Buenavista, Antique, Philippines"},
        {id:"capitol",name:"Antique Provincial Capitol",              address:"San Jose de Buenavista, Antique",note:"Central provincial landmark.",          kind:"command",   priority:{flood:1,fire:2,storm:1,roadblock:1,quake:2,medical:2},query:"Antique Provincial Capitol, San Jose de Buenavista, Antique, Philippines"}
      ],
      contacts:[
        {name:"San Jose MDRRMO",  number:"0917 709 6603",call:"+639177096603",sms:"+639177096603",detail:"Official San Jose de Buenavista MDRRMO hotline."},
        {name:"San Jose EMS",     number:"0927 815 4185",call:"+639278154185",sms:"+639278154185",detail:"Official emergency medical services."},
        {name:"San Jose EMS Alt", number:"0919 286 8863",call:"+639192868863",sms:"+639192868863",detail:"Alternate emergency medical services."},
        {name:"National Emergency Hotline",number:"911",call:"911",detail:"Nationwide emergency dispatch."}
      ]
    }
  };

  var scenarios={
    flood:{title:"Flood Scenario",radarLabel:"FLOOD",
      notes:{now:"Flood simulation is focused on immediate response actions.","6h":"Use the next 6 hours to prepare and build evacuation readiness.","12h":"Preparedness actions should be completed before the 12-hour risk window.","24h":"Plan for longer shelter, water, medicine, and device-charging needs."},
      impacts:{
        low:["Localized ponding may affect parts of {floodArea}.","Short travel delays are possible on drainage-heavy roads.","Ground floors should remain monitored for sudden overflow.","Evacuation is not yet urgent, but readiness should begin."],
        moderate:["Floodwater may affect low roads and homes nearest {floodArea}.","Motorcycles and small vehicles could lose safe passage on selected streets.","Power interruption risk increases in homes near drainage or overflow zones.","Families in single-storey homes should prepare for possible transfer."],
        high:["1 to 3 ft floodwater may affect {floodArea}.","Road access may become limited near riverbanks and drainage choke points.","Power interruption is possible in homes with low ground-floor elevation.","Pre-evacuation is strongly advised for elderly, children, and PWD households."],
        critical:["Fast-rising floodwater may isolate sections of {floodArea}.","Roads and side streets can become impassable with little warning.","Ground-floor living spaces may become unsafe for staying in place.","Immediate evacuation is recommended once official local orders are issued."]
      },
      actions:{
        low:["Check drainage outside your home and bring emergency items together.","Charge at least one phone and power bank.","Monitor official advisories and barangay announcements.","Review the nearest safe shelter before rain intensity increases."],
        moderate:["Move documents, medicines, and electronics above floor level.","Prepare a go bag for at least 24 hours.","Avoid parking or waiting in flood-prone streets.","Make sure every family member knows the evacuation route."],
        high:["Move appliances, documents, and medicine above waist level.","Charge phones and prepare a 24 to 48 hour go bag.","Switch off the main breaker once water enters the home.","Stand by for evacuation instructions and avoid flooded shortcuts."],
        critical:["Evacuate immediately once your barangay or DRRMO issues the order.","Do not attempt to cross moving floodwater on foot or by motorcycle.","Assist elderly, children, and PWD family members first.","Bring only essentials and head to the nearest safe place."]
      }
    },
    fire:{title:"Fire Scenario",radarLabel:"FIRE",
      notes:{now:"Fire simulation emphasizes first-minute evacuation and shutdown decisions.","6h":"Use the next 6 hours to reduce ignition risks and clear exits.","12h":"Inspection and prevention should be finished before the 12-hour window.","24h":"Maintain readiness for fire response through the next 24 hours."},
      impacts:{
        low:["A small fire may still spread through cluttered rooms or exposed wiring.","Smoke can reduce visibility before flames reach outer rooms.","Poorly marked exits slow evacuation time.","Prevention is the main goal at this level."],
        moderate:["Fire may spread more quickly across closely packed structures in {fireArea}.","Smoke inhalation becomes the main danger before flames cross full rooms.","Blocked gates and parked vehicles may slow responder access.","LPG and overloaded extension lines raise ignition risk."],
        high:["Fire may spread quickly across closely packed structures in {fireArea}.","Thick smoke can make hallways and doors unsafe within minutes.","Evacuation routes may narrow if vehicles or gates block exits.","Gas tanks and overloaded extension lines increase the chance of escalation."],
        critical:["Flash spread is possible across adjacent structures in {fireArea}.","Smoke conditions may become life-threatening before responders fully arrive.","People trapped on upper floors may require rescue support.","Immediate evacuation is the safest choice once fire reaches structural materials."]
      },
      actions:{
        low:["Unplug unused appliances and avoid overloading outlets.","Check that exits open fully and remain free of clutter.","Keep a flashlight and extinguisher in an easy-to-reach spot.","Review the family meeting point outside the home."],
        moderate:["Check LPG connections and turn off appliances that are not in use.","Keep doors and hallways clear for a quick exit.","Teach household members how to call for help and where to meet.","Do not leave open flames or active cooking unattended."],
        high:["Evacuate through the nearest cool exit and stay low beneath smoke.","If safe, shut off LPG and the main breaker.","Do not reopen hot doors or return for valuables.","Call responders and account for all household members at the assembly point."],
        critical:["Leave the structure immediately and warn nearby households.","Use only safe exits and never pass through thick smoke.","Keep the access road clear for fire responders.","Wait for responders at the designated safe distance and do a headcount."]
      }
    },
    storm:{title:"Storm Scenario",radarLabel:"STORM",
      notes:{now:"Storm simulation is focused on immediate sheltering and road safety actions.","6h":"Use the next 6 hours to finish securing the home and essential supplies.","12h":"Travel and supply plans should be finalized before the 12-hour window.","24h":"Prepare for extended outages, limited movement, and shelter support needs."},
      impacts:{
        low:["Light roof and debris movement is possible in exposed sections of {stormArea}.","Travel remains possible but should be monitored closely.","Signal or power flickers may occur in open areas.","Preparedness should begin before conditions intensify."],
        moderate:["Strong wind can affect exposed roofs and lightweight structures in {stormArea}.","Falling branches and debris may block selected access roads.","Power interruption becomes more likely if rain bands persist.","Travel risk rises on open-road and coastal sections."],
        high:["Strong winds may affect exposed roofs in {stormArea}.","Falling branches and debris can block road access.","Power outage and weak signal are likely if rain bands intensify.","Travel risk is high on coastal and open-road sections."],
        critical:["Roof failure or heavy debris impact is possible in the most exposed parts of {stormArea}.","Road closures may isolate coastal or hillside communities.","Extended power interruption is likely during the strongest impact window.","Sheltering indoors or relocation is safer than travel once conditions worsen."]
      },
      actions:{
        low:["Charge phones, lamps, and one power bank.","Bring in lightweight outdoor items before winds rise.","Monitor official advisories and travel updates.","Check food, medicine, and water for at least one day."],
        moderate:["Secure windows, roofing sheets, and outdoor objects.","Store water and ready-to-eat food for at least 24 hours.","Review the nearest safe shelter and who needs help first.","Avoid unnecessary travel once gusts and rain strengthen."],
        high:["Bring loose outdoor items inside and secure lightweight roofing.","Charge devices, lamps, and power banks.","Store drinking water, medicines, and ready-to-eat food.","Avoid non-essential travel and stay away from windows."],
        critical:["Move to the safest interior space or approved evacuation site.","Do not travel through coastal, flooded, or debris-blocked routes.","Keep emergency supplies and documents together in one carry bag.","Wait for official clearance before leaving shelter."]
      }
    },
    roadblock:{title:"Roadblock Scenario",radarLabel:"ROADBLOCK",
      notes:{now:"Roadblock simulation focuses on rerouting, access loss, and alternate support points.","6h":"Use the next 6 hours to identify alternate access roads and nearby support points.","12h":"Check which roads may remain closed and avoid depending on one single route.","24h":"Prepare for delayed travel, rerouting, and possible isolation of selected streets."},
      impacts:{
        low:["Minor obstructions may slow travel in parts of {location}.","One or two local roads may be temporarily limited.","Emergency vehicles may still pass but with delays.","Alternative access should already be reviewed."],
        moderate:["Barricades or debris may block selected streets in {location}.","Travel time to support points may increase noticeably.","Deliveries, pickups, and responder movement may slow down.","Households relying on one road access may need a backup route."],
        high:["Major roads or intersections may become impassable in {location}.","Responder access can be delayed if rerouting is required.","Nearest safe places may change depending on which route stays open.","Movement should shift early before more roads close."],
        critical:["Multiple routes may be cut off at the same time in {location}.","Some communities may experience temporary isolation.","Emergency access becomes highly dependent on the last open corridor.","Immediate rerouting to the safest reachable support point is advised."]
      },
      actions:{
        low:["Check alternate streets before leaving home.","Avoid lingering near barricades or clearing operations.","Keep your phone charged for map and route updates.","Use wider main roads when possible."],
        moderate:["Reroute early instead of waiting at blocked sections.","Keep one support point and one hospital route in mind.","Do not force vehicles through partially closed roads.","Follow official road closure guidance."],
        high:["Leave before nearby closures spread to your route.","Use the closest reachable safe place, not only the usual one.","Avoid narrow inner streets with uncertain exit points.","Stay in contact with family while rerouting."],
        critical:["Do not attempt to cross fully blocked or unstable roads.","Move using the fastest confirmed open route only.","Prioritize medical needs, children, elderly, and PWDs first.","Wait at a safe support point if access becomes cut off."]
      }
    },
    quake:{title:"Earthquake / Ashfall Scenario",radarLabel:"QUAKE / ASHFALL",
      notes:{now:"Earthquake / ashfall simulation focuses on life safety, structure risk, and respiratory protection.","6h":"Use the next 6 hours to secure exits, masks, water, and safe open areas.","12h":"Prepare for aftershocks, falling debris, reduced visibility, and limited travel.","24h":"Plan for longer sheltering, dust exposure, and delayed utility restoration."},
      impacts:{
        low:["Light shaking or thin ash may still affect movement in {location}.","Dust, reduced traction, and minor falling debris are possible.","People with asthma or respiratory issues may feel discomfort first.","Open areas remain safer than crowded enclosed spaces."],
        moderate:["Aftershocks or moderate ashfall may affect roads and rooftops in {location}.","Visibility can drop and breathing discomfort may increase outdoors.","Loose objects, ceiling materials, and signages may fall.","Travel should be limited to essential movement only."],
        high:["Structural risk, falling debris, or heavy ash buildup may affect parts of {location}.","Road visibility and air quality may worsen quickly.","Hospitals and open staging areas become more important than normal routes.","People should move away from damaged structures immediately."],
        critical:["Severe structural damage or dense ash may make some areas unsafe to remain in.","Roads may become hazardous because of debris, dust, and unstable buildings.","Aftershock danger remains high near damaged structures.","Immediate relocation to a safer open or medical support point is advised."]
      },
      actions:{
        low:["Prepare masks, water, flashlight, and footwear.","Stay away from shelves, glass, and loose hanging objects.","Review the nearest open safe area.","Monitor official advisories for aftershock or ash direction updates."],
        moderate:["Wear a mask or cloth covering when going outside.","Move away from cracked walls, damaged posts, and loose roofing.","Keep exits clear and avoid elevators or unstable stairways.","Limit travel unless necessary."],
        high:["Evacuate from visibly damaged structures immediately.","Protect nose, mouth, and eyes from dust or ash.","Use open areas or medical support points as priority destinations.","Expect slower travel because of visibility and debris."],
        critical:["Do not stay inside a structure showing major damage.","Move only through clear, open, and stable routes.","Prioritize injured family members and those with breathing difficulty.","Wait for official clearance before returning to any damaged area."]
      }
    },
    medical:{title:"Medical Scenario",radarLabel:"MEDICAL",
      notes:{now:"Medical simulation focuses on fastest access to treatment and responder contact.","6h":"Use the next 6 hours to prepare transport, medicines, and emergency contact options.","12h":"Check which medical support points remain reachable within the next 12 hours.","24h":"Prepare for continued medicine needs, referral transfers, and rest support."},
      impacts:{
        low:["Minor injuries or symptoms may still worsen without early attention.","Delays in transport can increase discomfort and risk.","Nearest hospital access should already be known.","Communication with responders matters early."],
        moderate:["Medical needs in {location} may require faster transport than normal travel allows.","Delays in road access can affect treatment timing.","People with fever, breathing difficulty, or trauma need closer monitoring.","A medical support point becomes higher priority than a general shelter."],
        high:["Urgent cases may need immediate movement to the nearest hospital or EMS-supported point.","Travel time becomes critical for trauma, breathing issues, or severe pain.","Route choice should prioritize speed and access over familiarity.","Households may need responder guidance while moving."],
        critical:["Life-threatening symptoms require immediate responder or hospital access.","Any delay in reaching treatment can sharply raise risk.","Fastest reachable medical point should override all other support preferences.","Emergency contact escalation should happen right away."]
      },
      actions:{
        low:["Keep medicines, IDs, and emergency contact numbers together.","Check the closest hospital route before travel is needed.","Monitor symptoms and avoid delaying care too long.","Keep one family member ready to assist."],
        moderate:["Prepare transport and essential medicines immediately.","Call ahead to DRRMO, EMS, or hospital if travel may be delayed.","Avoid unnecessary stops during transport.","Use the fastest main-road route available."],
        high:["Move to the nearest reachable medical support point now.","Bring IDs, medication list, and emergency contact details.","Call responders while en route when possible.","Do not delay travel for non-essential belongings."],
        critical:["Call emergency responders or 911 immediately.","Use the fastest medical route without detours.","Keep the patient stable, seated, or supported during movement.","Head straight to the top-ranked medical support point."]
      }
    }
  };

  var geocodeCache={};
  var routeMap=null,routeLine=null,routeMarkers=[],routeOptions=[],activeRouteKey=null;

  /* ── Map ── */
  function initRouteMap() {
    if (routeMap||typeof L==="undefined") return;
    var mapEl=document.getElementById("routeMap"); if (!mapEl) return;
    routeMap=L.map(mapEl,{zoomControl:false,attributionControl:true}).setView(locations[state.location].center,12);
    setTimeout(function(){if(routeMap)routeMap.invalidateSize();},80);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(routeMap);
  }
  function clearRouteVisuals() {
    if (routeLine&&routeMap){routeMap.removeLayer(routeLine);routeLine=null;}
    routeMarkers.forEach(function(m){if(routeMap)routeMap.removeLayer(m);}); routeMarkers=[];
  }
  function drawRouteOnMap(origin,result) {
    if (!routeMap||typeof L==="undefined") return;
    clearRouteVisuals();
    var coords=result.route.geometry.coordinates.map(function(p){return[p[1],p[0]];});
    routeLine=L.polyline(coords,{weight:5,opacity:0.95}).addTo(routeMap);
    routeMarkers.push(L.marker(origin).addTo(routeMap).bindPopup("Your position"));
    routeMarkers.push(L.marker(result.place.coords).addTo(routeMap).bindPopup("<strong>"+esc(result.place.name)+"</strong><br>"+esc(result.place.address||"")));
    routeMap.fitBounds(routeLine.getBounds(),{padding:[26,26]});
  }

  /* ── Directions ── */
  function simplifyStep(step) {
    var m=step.maneuver||{},type=m.type||"Continue",mod=m.modifier?String(m.modifier):"",roadName=step.name?" onto "+step.name:"";
    var pm={depart:"Start",arrive:"Arrive",turn:"Turn",newName:"Continue",merge:"Merge",roundabout:"Enter the roundabout",fork:"Keep",endOfRoad:"At the end of the road turn",continue:"Continue"};
    var label=(pm[type]||type)+(mod?" "+mod.toLowerCase():"");
    var dist=step.distance?" ("+formatRouteDist(step.distance/1000)+")":"";
    return label+roadName+dist;
  }
  function renderRouteDirections(steps) {
    var list=document.getElementById("routeDirections"); if (!list) return;
    if (!steps||!steps.length){list.innerHTML="<li>Direction steps will appear after the route is calculated.</li>";return;}
    list.innerHTML=steps.slice(0,6).map(function(s){return"<li>"+esc(simplifyStep(s))+"</li>";}).join("");
  }

  /* ── Route options UI ── */
  function renderRouteOptionsUI() {
    var wrap=document.getElementById("routeOptions"); if (!wrap) return;
    if (!routeOptions.length){
      wrap.innerHTML="<div class=\"route-option-empty\">Tap <strong>Use My Location</strong> to load multiple route choices.</div>";
      return;
    }
    if (!activeRouteKey&&routeOptions.length>0) activeRouteKey=routeOptions[0].key;
    var hint=document.getElementById("routeOptionsHint");
    if (hint) hint.textContent="Showing "+Math.min(routeOptions.length,6)+" route option"+(routeOptions.length>1?"s":"")+" for "+state.scenario;
    wrap.innerHTML=routeOptions.slice(0,6).map(function(opt,idx){
      var isActive=(activeRouteKey===opt.key);
      var label=idx===0?"Best overall":(opt.routeIndex===0?"Other destination":"Alternate path");
      var altText=opt.routeIndex>0?"Alt path "+opt.routeIndex:"Main path";
      var cls="route-option-card"+(isActive?" is-current is-active":"");
      return "<button type=\"button\" class=\""+cls+"\" data-hub-route-key=\""+esc(opt.key)+"\">"+
        "<span class=\"route-option-top\"><span class=\"route-option-badge\">"+esc(label)+"</span><span class=\"route-option-path\">"+esc(altText)+"</span></span>"+
        "<strong>"+esc(opt.place.name)+"</strong>"+
        "<span class=\"route-option-meta\">"+esc(formatMinutes(opt.route.duration/60)+" • "+formatRouteDist(opt.route.distance/1000))+"</span>"+
        "<span class=\"route-option-note\">"+esc(opt.place.address||"")+"</span></button>";
    }).join("");
  }

  function applyHubRouteOption(opt) {
    activeRouteKey=opt.key; state.lastRoute=opt;
    setText("routeTargetName",opt.place.name);
    setText("routeTargetSub",opt.place.address||"");
    setText("routeEta",formatMinutes(opt.route.duration/60));
    setText("routeDistance",formatRouteDist(opt.route.distance/1000));
    var dec=getDecisionInfo();
    setText("routeAdvice",dec.movement);
    setText("routeModeHint",dec.movementNote);
    setText("routeSummary","Showing route to "+opt.place.name+". Switch cards below to compare other options.");
    setText("routeDirectionsHint","Turn-by-turn steps below match the selected route.");
    if (routeMap&&state.userPosition) drawRouteOnMap(state.userPosition,opt);
    renderRouteDirections(opt.route.legs&&opt.route.legs[0]?opt.route.legs[0].steps:[]);
    renderRouteOptionsUI();
    setText("radarSafePlace",opt.place.name);
    updateRadarDecision();
  }

  function bindHubRouteOptionClicks() {
    document.addEventListener("click",function(e){
      var btn=e.target.closest("[data-hub-route-key]"); if (!btn) return;
      var container=document.getElementById("routeOptions");
      if (container) container.querySelectorAll(".route-option-card").forEach(function(c){c.classList.remove("is-current","is-active");});
      btn.classList.add("is-current","is-active");
      var key=btn.getAttribute("data-hub-route-key");
      var opt=routeOptions.find(function(o){return o.key===key;});
      if (opt){applyHubRouteOption(opt);window.showToast("Route view changed.");}
    });
  }

  /* ── Formatters ── */
  function scenarioIconFor(k){return{flood:"🌊",fire:"🔥",storm:"🌪",roadblock:"🚧",quake:"🌋",medical:"🚑"}[k]||"⚠";}
  function severityIconFor(k){return{low:"🟢",moderate:"🟡",high:"🟠",critical:"🔴"}[k]||"⚠";}
  function timeIconFor(k){return{now:"🕒","6h":"⏳","12h":"⌛","24h":"📅"}[k]||"🕒";}
  function kindLabel(k){return{command:"Command point",medical:"Medical support",open:"Open safe area",government:"Government support"}[k]||"Support point";}
  function formatText(text,tokens){return String(text).replace(/\{(\w+)\}/g,function(_,key){return Object.prototype.hasOwnProperty.call(tokens,key)?tokens[key]:"";});}
  function getTokens(){var loc=locations[state.location];return{location:loc.label,severity:severityLabels[state.severity],time:timeLabels[state.time],floodArea:loc.floodArea,fireArea:loc.fireArea,stormArea:loc.stormArea};}
  function formatDistance(km){if(km==null||!isFinite(km))return"Distance unavailable";return km<1?Math.round(km*1000)+" m away":km.toFixed(1)+" km away";}
  function formatMinutes(m){if(!isFinite(m))return"--";return m<60?Math.max(1,Math.round(m))+" min":Math.floor(m/60)+"h "+Math.round(m%60)+"m";}
  function formatRouteDist(km){if(km==null||!isFinite(km))return"--";return km<1?Math.round(km*1000)+" m total":km.toFixed(1)+" km total";}
  function haversineKmSim(a,b){if(!a||!b)return null;var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLng=(b[1]-a[1])*Math.PI/180,lat1=a[0]*Math.PI/180,lat2=b[0]*Math.PI/180,h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)*Math.sin(dLng/2);return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  function getPrimaryPlace(list){return list.slice().sort(function(a,b){return((a.priority||{})[state.scenario]||9)-((b.priority||{})[state.scenario]||9);})[0]||null;}
  function resetExpandedLists(){state.expanded.impact=false;state.expanded.action=false;}
  function getSeverityScore(k){return{low:28,moderate:52,high:76,critical:92}[k]||50;}
  function getTimeScore(k){return{now:8,"6h":5,"12h":3,"24h":1}[k]||0;}

  function getDecisionInfo() {
    var loc=locations[state.location],primaryPlace=getPrimaryPlace(loc.safePlaces),primaryContact=loc.contacts[0]||null;
    var score=Math.max(18,Math.min(99,getSeverityScore(state.severity)+getTimeScore(state.time)));
    var byScenario={
      flood:{
        low:{status:"Monitor drains",priority:"Stay alert",note:"Watch for road ponding and keep essentials ready.",why:"Floodwater can rise fast in low-lying drainage corridors once rain bands repeat.",movement:"Prefer higher roads",summary:"Use elevated roads and avoid low crossings first."},
        moderate:{status:"Prepare to move",priority:"Raise essentials",note:"Move valuables higher and review your nearest safe route.",why:"Water can begin collecting in road dips and near river-adjacent communities.",movement:"Avoid flooded shortcuts",summary:"Choose main roads with better drainage and avoid shortcuts."},
        high:{status:"Pre-evacuate",priority:"Ready go bag",note:"Pre-position medicines, IDs, and chargers now.",why:"High flood exposure can cut off low roads before a formal evacuation order.",movement:"Leave before roads worsen",summary:"Move early using the safest drivable route before water deepens."},
        critical:{status:"Evacuate now",priority:"Move immediately",note:"Relocate vulnerable family members first.",why:"Critical flood conditions can turn passable roads unsafe within minutes.",movement:"Do not cross water",summary:"Take the fastest dry route to the recommended support point now."}
      },
      fire:{
        low:{status:"Check exits",priority:"Stay ready",note:"Keep exits clear and monitor heat or smoke changes.",why:"Small ignition sources become dangerous in dense commercial and residential blocks.",movement:"Use open frontages",summary:"Keep to wide roads and clear exits away from congested blocks."},
        moderate:{status:"Stand by to leave",priority:"Clear exits",note:"Prepare to move out if smoke or flames spread.",why:"Fire spread risk increases quickly where buildings are closely spaced.",movement:"Avoid narrow alleys",summary:"Choose wide access roads and open gathering points first."},
        high:{status:"Move to open area",priority:"Evacuate block",note:"Shift to a wide open landmark and wait for responders.",why:"High fire spread can block escape paths, so open staging areas are safer.",movement:"Use clear outward lanes",summary:"Use the fastest route toward an open or command point."},
        critical:{status:"Leave immediately",priority:"Life safety first",note:"Do not return for belongings or vehicles.",why:"Critical fire conditions can block exits, reduce visibility, and spread rapidly.",movement:"Upwind, away from smoke",summary:"Move immediately to the nearest open or medical support point."}
      },
      storm:{
        low:{status:"Secure property",priority:"Monitor gusts",note:"Tie down light items and review support points.",why:"Even lower-level winds can down light materials and weaken temporary structures.",movement:"Use protected roads",summary:"Prefer sheltered roads and keep travel short."},
        moderate:{status:"Reduce travel",priority:"Protect home",note:"Charge devices and avoid exposed roads if weather worsens.",why:"Moderate storm conditions often bring debris and short power interruptions.",movement:"Avoid coastal lanes",summary:"Use inland roads when possible and avoid open coastal stretches."},
        high:{status:"Shelter or relocate",priority:"Travel now if needed",note:"Finish travel before stronger winds and rain bands arrive.",why:"High storm impact can isolate coastal or exposed communities.",movement:"Use inland route",summary:"Take the quickest inland route to the safest support point."},
        critical:{status:"Stay sheltered",priority:"Move only if ordered",note:"Relocate only before the strongest impact window.",why:"Critical storm conditions can make travel unsafe because of debris and flooding.",movement:"Avoid exposed travel",summary:"Use the shortest protected route only if relocation is necessary."}
      },
      roadblock:{
        low:{status:"Check alternate roads",priority:"Stay flexible",note:"Review backup roads before leaving.",why:"Minor blockages can still snowball into long delays if you depend on one route.",movement:"Use wider roads",summary:"Prefer wide roads with more than one exit option."},
        moderate:{status:"Reroute early",priority:"Avoid closure points",note:"Do not wait near barricades or debris clearing zones.",why:"Moderate road closures can redirect traffic into slower and narrower streets.",movement:"Skip blocked corridors",summary:"Shift to a safe alternate route before traffic builds up."},
        high:{status:"Use backup access now",priority:"Move before isolation",note:"Travel while at least one clear route remains available.",why:"High road closure risk can isolate normal access paths with little warning.",movement:"Take the safest open lane",summary:"Use the best confirmed open road toward support."},
        critical:{status:"Access severely limited",priority:"Reach safe point",note:"Head for the nearest reachable support point immediately.",why:"Critical blockage can trap movement and delay responders if you wait too long.",movement:"Do not force blocked roads",summary:"Only use confirmed open routes and avoid unstable closures."}
      },
      quake:{
        low:{status:"Watch surroundings",priority:"Stay clear of hazards",note:"Keep away from loose objects and dusty enclosed spaces.",why:"Even light shaking or thin ash can create falling-object and breathing risks.",movement:"Prefer open areas",summary:"Use open, stable areas and avoid damaged-looking structures."},
        moderate:{status:"Reduce exposure",priority:"Protect airway",note:"Use a mask and avoid damaged structures.",why:"Moderate ash or aftershock conditions raise both respiratory and structural risk.",movement:"Avoid damaged roads",summary:"Use clear routes away from cracked structures and debris."},
        high:{status:"Move to safer ground",priority:"Leave unsafe structures",note:"Open areas and medical points take priority now.",why:"High quake or ash impact can make buildings, roads, and visibility unsafe quickly.",movement:"Use clear open paths",summary:"Travel only through clear routes toward open or medical support."},
        critical:{status:"Evacuate danger zone",priority:"Life safety first",note:"Do not remain inside visibly damaged structures.",why:"Critical structural instability or dense ash can make staying in place dangerous.",movement:"Move only on stable routes",summary:"Use the clearest open route to the safest reachable support point."}
      },
      medical:{
        low:{status:"Monitor symptoms",priority:"Prepare transport",note:"Keep medicines and contacts ready.",why:"Even lower-severity symptoms can worsen if treatment is delayed too long.",movement:"Use fastest familiar road",summary:"Keep travel simple and direct."},
        moderate:{status:"Get ready to move",priority:"Reach care sooner",note:"Check the nearest hospital or EMS-supported route now.",why:"Moderate medical need becomes harder to manage if access is delayed.",movement:"Prefer main roads",summary:"Choose the clearest direct route to medical support."},
        high:{status:"Go to medical support",priority:"Urgent treatment",note:"Hospital access should take priority over general shelter.",why:"High medical urgency means travel time matters more than routine route preference.",movement:"Fastest safe route only",summary:"Take the quickest safe route to the nearest medical point."},
        critical:{status:"Emergency response now",priority:"Immediate care",note:"Call responders or 911 without delay.",why:"Critical cases can deteriorate sharply when treatment is delayed.",movement:"Direct to hospital",summary:"Head straight to the top medical support point and alert responders."}
      }
    };
    var info=byScenario[state.scenario][state.severity];
    return{
      score:score,status:info.status,actionPriority:info.priority,actionNote:info.note,
      whyNow:info.why,movement:info.movement,movementNote:info.summary,
      safePlace:state.lastRoute&&state.lastRoute.place?state.lastRoute.place.name:(primaryPlace?primaryPlace.name:"Awaiting route selection"),
      primaryContact:primaryContact?primaryContact.name+" • "+primaryContact.number:"Use nearest DRRMO or 911"
    };
  }

  /* ── Location detection ── */
  function getStoredScenarioCoords() {
    try{var s=JSON.parse(localStorage.getItem("handavisLastKnownLocation")||"null");if(s&&typeof s.lat==="number"&&typeof s.lng==="number")return[s.lat,s.lng];}catch(e){}return null;
  }
  function saveScenarioCoords(coords) {
    try{localStorage.setItem("handavisLastKnownLocation",JSON.stringify({lat:coords[0],lng:coords[1],savedAt:Date.now()}));}catch(e){}
  }
  function getNearestScenarioLocationKey(coords) {
    var nearestKey=state.location,nearestDist=Number.MAX_SAFE_INTEGER;
    Object.keys(locations).forEach(function(key){
      var d=haversineKmSim(coords,locations[key].center);
      if(d<nearestDist){nearestDist=d;nearestKey=key;}
    });
    return nearestKey;
  }

  function applyScenarioCoords(coords) {
    if (!coords||!coords.length) return;
    state.userPosition=coords;
    state.location=getNearestScenarioLocationKey(coords);
    state.locationMode="current";
    // Update evacuation center pool to closest centers from any city
    if (window._getNearestEvacuationCenters) {
      window.EVACUATION_CENTERS=window._getNearestEvacuationCenters(coords,5);
    }
    // Update the location label shown in the search pill (revealed only after user clicks route)
    state.userLocationLabel=locations[state.location].label;
    syncScenarioLocationSelect();
  }

  function syncScenarioLocationSelect() {
    var sel=document.getElementById("simLocation"); if (!sel) return;
    if (!sel.options.length) sel.innerHTML="<option value=\"current\" selected>Use Current Location</option>";
    sel.value="current";
    sel.options[0].textContent=state.userPosition?"Use Current Location \u2022 "+locations[state.location].label:"Use Current Location";
  }

  async function refreshScenarioCurrentLocation(showFeedback) {
    var fallback=getStoredScenarioCoords()||(locations[state.location]&&locations[state.location].center)||[10.6766,122.9511];
    if (!navigator.geolocation){applyScenarioCoords(fallback);if(showFeedback)window.showToast("Live location unavailable. Using nearest saved area.");return state.location;}
    return new Promise(function(resolve){
      navigator.geolocation.getCurrentPosition(
        function(pos){
          var c=[pos.coords.latitude,pos.coords.longitude];
          saveScenarioCoords(c);applyScenarioCoords(c);
          if(showFeedback)window.showToast("Location synced to "+locations[state.location].label+".");
          resolve(state.location);
        },
        function(){
          applyScenarioCoords(fallback);
          if(showFeedback)window.showToast("Unable to get live location. Using nearest saved area.");
          resolve(state.location);
        },
        {enableHighAccuracy:true,timeout:9000,maximumAge:120000}
      );
    });
  }

  async function getCurrentPositionOrFallback() {
    var fallback=getStoredScenarioCoords()||(locations[state.location]&&locations[state.location].center)||[10.6766,122.9511];
    if (!navigator.geolocation){applyScenarioCoords(fallback);window.showToast("Location access unavailable. Using nearest saved area.");return fallback;}
    return new Promise(function(resolve){
      navigator.geolocation.getCurrentPosition(
        function(pos){var c=[pos.coords.latitude,pos.coords.longitude];saveScenarioCoords(c);applyScenarioCoords(c);resolve(c);},
        function(){applyScenarioCoords(fallback);window.showToast("Unable to access live location. Using nearest saved area.");resolve(fallback);},
        {enableHighAccuracy:true,timeout:9000,maximumAge:120000}
      );
    });
  }

  /* ── Location search UI (the blue/red pill widget) ── */
  function updateLocationSearchUI() {
    var locateBtn=document.getElementById("routeLocateBtn");
    var searchGroup=document.getElementById("locationSearchGroup");
    var pillText=document.querySelector("#locationSearchGroup .pill-text");
    if (!locateBtn||!searchGroup) return;
    if (state.userPosition) {
      locateBtn.style.display="none";
      searchGroup.style.display="flex";
      if (pillText) pillText.textContent=state.userLocationLabel||locations[state.location].label||"Current location";
    } else {
      locateBtn.style.display="";
      searchGroup.style.display="none";
    }
  }

  /* Search input: filter all evacuation centers by name */
  function bindCenterSearchInput() {
    var input=document.getElementById("centerSearchInput");
    var addBtn=document.querySelector("#locationSearchGroup .add-btn");
    if (!input) return;

    var dropdown=document.createElement("div");
    dropdown.id="centerSearchDropdown";
    dropdown.style.cssText="position:absolute;top:100%;left:0;right:0;background:#0f1c2e;border:1px solid rgba(95,216,255,.22);border-radius:14px;overflow:hidden;z-index:999;margin-top:4px;box-shadow:0 12px 28px rgba(0,0,0,.4);display:none;";
    var pillContainer=input.closest(".pill-input-container");
    if (pillContainer){pillContainer.style.position="relative";pillContainer.appendChild(dropdown);}

    function showDropdown(results) {
      if (!results.length){dropdown.style.display="none";return;}
      dropdown.innerHTML=results.map(function(c){
        return "<button type=\"button\" style=\"width:100%;text-align:left;padding:11px 14px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.06);color:#e8f4ff;cursor:pointer;font-size:0.85rem;\" data-center-id=\""+esc(c.id)+"\">"+
          "<strong style=\"display:block;font-weight:700;\">"+esc(c.name)+"</strong>"+
          (state.userPosition?"<small style=\"color:#7dc8f0;\">"+formatDistance(haversineKmSim(state.userPosition,c.coords))+"</small>":"")+
          "</button>";
      }).join("");
      dropdown.style.display="block";
    }

    function closeDropdown(){dropdown.style.display="none";}

    input.addEventListener("input",function(){
      var q=this.value.trim().toLowerCase();
      if (!q){closeDropdown();return;}
      var allCenters=window._getAllCentersFlat?window._getAllCentersFlat():[];
      var results=allCenters.filter(function(c){return c.name.toLowerCase().indexOf(q)>-1;}).slice(0,6);
      showDropdown(results);
    });

    dropdown.addEventListener("click",function(e){
      var btn=e.target.closest("[data-center-id]"); if (!btn) return;
      var id=btn.getAttribute("data-center-id");
      var allCenters=window._getAllCentersFlat?window._getAllCentersFlat():[];
      var found=allCenters.find(function(c){return c.id===id;});
      if (found){
        input.value=found.name;
        closeDropdown();
        calculateBestRoute(id);
      }
    });

    // Add button clears and recalculates with current auto-selection
    if (addBtn) addBtn.addEventListener("click",function(){input.value="";calculateBestRoute();});

    // Close dropdown when clicking outside
    document.addEventListener("click",function(e){if(!input.contains(e.target)&&!dropdown.contains(e.target))closeDropdown();});
  }

  /* ── Geocoding ── */
  async function geocodePlace(place) {
    if (place.coords) return place.coords;
    if (geocodeCache[place.query]){place.coords=geocodeCache[place.query];return place.coords;}
    var res=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(place.query),{headers:{"Accept":"application/json"}});
    if (!res.ok) throw new Error("Unable to geocode destination");
    var results=await res.json();
    if (!results||!results.length) throw new Error("Destination not found");
    place.coords=[parseFloat(results[0].lat),parseFloat(results[0].lon)];
    geocodeCache[place.query]=place.coords;
    return place.coords;
  }
  async function ensurePlacesGeocoded(list){for(var i=0;i<list.length;i++){try{await geocodePlace(list[i]);}catch(e){console.warn(e);}}}

  /* ── Render helpers ── */
  function renderCollapsibleList(id,items,itemClass,toggleId,expandedKey,limit) {
    var elList=document.getElementById(id),toggle=document.getElementById(toggleId); if(!elList)return;
    var maxV=typeof limit==="number"?limit:2,expanded=!!state.expanded[expandedKey],shouldCollapse=items.length>maxV;
    var visible=shouldCollapse&&!expanded?items.slice(0,maxV):items;
    elList.innerHTML=visible.map(function(item){return"<li class=\""+itemClass+"\">"+esc(item)+"</li>";}).join("");
    if (!toggle) return;
    if (!shouldCollapse){toggle.hidden=true;toggle.setAttribute("aria-expanded","false");return;}
    toggle.hidden=false;toggle.textContent=expanded?"See less":"See more";toggle.setAttribute("aria-expanded",expanded?"true":"false");
  }

  function applyThemeVars() {
    var els=[document.getElementById("scenarioSim"),document.getElementById("scenarioPreview"),document.getElementById("radarCard")];
    var stRgb=scenarioThemes[state.scenario],svRgb=severityThemes[state.severity];
    els.forEach(function(e){if(!e)return;e.style.setProperty("--scenario-rgb",stRgb);e.style.setProperty("--severity-rgb",svRgb);e.dataset.scenario=state.scenario;e.dataset.severity=state.severity;});
    var sf=document.querySelector(".scenario-field-severity");if(sf)sf.style.setProperty("--field-rgb",svRgb);
  }

  function updateRiskBadge(levelKey) {
    var badge=document.getElementById("simRiskBadge"); if(!badge)return;
    badge.textContent=severityLabels[levelKey].toUpperCase();badge.className="scenario-risk-pill "+levelKey;
  }

  function renderPlaces(items) {
    var elList=document.getElementById("simSafePlaces"); if(!elList)return;
    var origin=state.userPosition;
    var sorted=items.slice().sort(function(a,b){
      var ap=(a.priority||{})[state.scenario]||9,bp=(b.priority||{})[state.scenario]||9;
      if(ap!==bp)return ap-bp;
      var ad=origin&&a.coords?haversineKmSim(origin,a.coords):Number.MAX_SAFE_INTEGER;
      var bd=origin&&b.coords?haversineKmSim(origin,b.coords):Number.MAX_SAFE_INTEGER;
      return ad-bd;
    });
    elList.innerHTML=sorted.map(function(item){
      var approx=origin&&item.coords?formatDistance(haversineKmSim(origin,item.coords)):"Route estimate appears after location is shared";
      return"<div class=\"scenario-place-card\">"+
        "<div class=\"scenario-place-top\"><strong>"+esc(item.name)+"</strong><span class=\"place-kind-badge\">"+esc(kindLabel(item.kind))+"</span></div>"+
        "<span class=\"scenario-place-address\">"+esc(item.address)+"</span>"+
        "<span>"+esc(item.note)+"</span>"+
        "<div class=\"scenario-place-footer\"><small>"+esc(approx)+"</small><button type=\"button\" class=\"scenario-mini-btn\" data-route-place=\""+esc(item.id)+"\">Route here</button></div>"+
        "</div>";
    }).join("");
  }

  function renderContacts(items) {
    var elList=document.getElementById("simContacts"); if(!elList)return;
    elList.innerHTML=items.map(function(item){
      var actions="<div class=\"scenario-contact-actions\">";
      if(item.call)actions+="<a class=\"scenario-contact-btn\" href=\"tel:"+encodeURIComponent(item.call)+"\">Call</a>";
      if(item.sms) actions+="<a class=\"scenario-contact-btn secondary\" href=\"sms:"+encodeURIComponent(item.sms)+"\">Text</a>";
      actions+="</div>";
      return"<div class=\"scenario-contact-item\"><div class=\"scenario-contact-top\"><strong>"+esc(item.name)+"</strong><span class=\"scenario-contact-number\">"+esc(item.number)+"</span></div><span>"+esc(item.detail)+"</span>"+actions+"</div>";
    }).join("");
  }

  function setActiveScenarioButtons() {
    document.querySelectorAll(".scenario-tab").forEach(function(btn){
      var active=btn.getAttribute("data-scenario")===state.scenario;
      btn.classList.toggle("is-active",active);btn.setAttribute("aria-selected",active?"true":"false");
    });
  }

  function updateRadarDecision() {
    var scenario=scenarios[state.scenario],loc=locations[state.location],dec=getDecisionInfo();
    setText("radarRegionLabel","Western Visayas \u2022 "+loc.label);
    setText("radarRiskLabel",scenario.radarLabel);
    setText("radarRiskSub",severityLabels[state.severity]+" \u2022 "+timeLabels[state.time]);
    setText("radarScenarioTag",scenarioIconFor(state.scenario)+" Scenario: "+scenario.title.replace(/\s+Scenario$/i,""));
    setText("radarLocationTag","\uD83D\uDCCD Location: "+loc.label);
    setText("radarSeverityTag",severityIconFor(state.severity)+" Severity: "+severityLabels[state.severity]);
    setText("radarTimeTag",timeIconFor(state.time)+" Time: "+timeLabels[state.time]);
    setText("radarStatusPill",dec.status);
    setText("radarRiskScore",dec.score+" / 100");
    setText("radarRiskScoreNote",dec.whyNow);
    setText("radarActionPriority",dec.actionPriority);
    setText("radarActionNote",dec.actionNote);
    setText("radarSafePlace",dec.safePlace);
    setText("radarPrimaryContact",dec.primaryContact);
    setText("radarLiveTrigger","Simulation mode active");
    setText("radarLiveTriggerMeta","Connect to the Live Alerts page for real-time Western Visayas advisories.");
    setText("radarDecisionText",dec.whyNow+" "+dec.movementNote);
  }

  /* ── Route fetching ── */
  async function fetchRouteOptionsForPlace(origin, destination, place) {
    var url="https://router.project-osrm.org/route/v1/driving/"+origin[1]+","+origin[0]+";"+destination[1]+","+destination[0]+"?alternatives=true&overview=full&geometries=geojson&steps=true";
    var response=await fetch(url); if(!response.ok)throw new Error("Route service unavailable");
    var data=await response.json(); if(!data.routes||!data.routes.length)throw new Error("No route found");
    return data.routes.map(function(route,index){
      var key=[state.scenario,place.id,index].join("-").toLowerCase().replace(/\s+/g,"");
      return{key:key,place:place,route:route,routeIndex:index,score:route.duration};
    });
  }

  async function calculateBestRoute(preferredPlaceId) {
    if (state.routeBusy) return;
    state.routeBusy=true;
    var routeBtn=document.getElementById("simRouteBtn"),locateBtn=document.getElementById("routeLocateBtn");
    if(routeBtn)routeBtn.textContent="Calculating...";
    if(locateBtn)locateBtn.textContent="Calculating...";
    activeRouteKey=null;routeOptions=[];

    try {
      initRouteMap();
      var origin=await getCurrentPositionOrFallback();
      state.userPosition=origin;
      updateLocationSearchUI(); // reveal the pill widget, hide the button
      var activeCenters=window.EVACUATION_CENTERS;
      renderScenario();
      await ensurePlacesGeocoded(activeCenters);
      renderPlaces(activeCenters);

      var sortedCandidates=activeCenters.slice().sort(function(a,b){
        if(preferredPlaceId){if(a.id===preferredPlaceId)return -1;if(b.id===preferredPlaceId)return 1;}
        var ad=a.coords?haversineKmSim(origin,a.coords):Number.MAX_SAFE_INTEGER;
        var bd=b.coords?haversineKmSim(origin,b.coords):Number.MAX_SAFE_INTEGER;
        return ad-bd;
      }).slice(0,3);

      var results=[];
      for(var i=0;i<sortedCandidates.length;i++){
        if(!sortedCandidates[i].coords)continue;
        try{var opts=await fetchRouteOptionsForPlace(origin,sortedCandidates[i].coords,sortedCandidates[i]);results=results.concat(opts);}catch(e){console.warn(e);}
      }
      if(!results.length)throw new Error("No route could be calculated.");
      results.sort(function(a,b){return a.score-b.score;});
      routeOptions=results;

      var active=preferredPlaceId?(results.find(function(r){return r.place.id===preferredPlaceId;})||results[0]):results[0];
      if(active){activeRouteKey=active.key;applyHubRouteOption(active);}
      renderRouteOptionsUI();
      window.showToast("Route options loaded.");
    } catch(err) {
      console.error(err);window.showToast(err.message||"Route calculation failed.");renderRouteOptionsUI();
    } finally {
      state.routeBusy=false;
      if(routeBtn)routeBtn.textContent="Find Closest Safe Route";
      if(locateBtn)locateBtn.textContent="Use My Location";
    }
  }

  /* ── Render scenario ── */
  function renderScenario() {
    var scenario=scenarios[state.scenario],loc=locations[state.location],tokens=getTokens();
    setText("simScenarioTitle",scenario.title);
    setText("simContext",loc.label+" \u2022 "+severityLabels[state.severity]+" severity \u2022 "+timeLabels[state.time]);
    setText("simTimeBadge",timeLabels[state.time]);
    setText("simSummaryNote",scenario.notes[state.time]);
    applyThemeVars();updateRiskBadge(state.severity);
    renderCollapsibleList("simImpactList",scenario.impacts[state.severity].map(function(i){return formatText(i,tokens);}), "scenario-impact-item","simImpactToggle","impact",2);
    renderCollapsibleList("simActionList",scenario.actions[state.severity].map(function(i){return formatText(i,tokens);}), "scenario-check-item","simActionToggle","action",2);
    syncScenarioLocationSelect();
    var sevSel=document.getElementById("simSeverity");if(sevSel)sevSel.value=state.severity;
    var timSel=document.getElementById("simTime");if(timSel)timSel.value=state.time;
    setActiveScenarioButtons();updateRadarDecision();
    renderPlaces(window.EVACUATION_CENTERS);
    renderContacts(loc.contacts);
  }

  /* ── Plan download ── */
  function downloadPlan() {
    var scenario=scenarios[state.scenario],loc=locations[state.location],tokens=getTokens(),dec=getDecisionInfo();
    var payload={
      scenario:scenario.title,location:loc.label,severity:severityLabels[state.severity],timeWindow:timeLabels[state.time],
      generatedAt:new Date().toLocaleString(),
      impacts:scenario.impacts[state.severity].map(function(i){return formatText(i,tokens);}),
      actions:scenario.actions[state.severity].map(function(i){return formatText(i,tokens);}),
      safePlaces:loc.safePlaces.map(function(i){return{name:i.name,address:i.address,note:i.note};}),
      contacts:loc.contacts.map(function(i){return{name:i.name,number:i.number,detail:i.detail};}),
      decision:{score:dec.score+" / 100",status:dec.status,actionPriority:dec.actionPriority,actionNote:dec.actionNote,movement:dec.movement,movementNote:dec.movementNote,safePlace:dec.safePlace,primaryContact:dec.primaryContact},
      filename:"handavis-"+state.scenario+"-"+state.location+"-plan.pdf"
    };
    var form=document.createElement("form");form.method="POST";form.action="generate_plan_pdf.php";form.target="_blank";
    var input=document.createElement("input");input.type="hidden";input.name="plan_data";input.value=JSON.stringify(payload);
    form.appendChild(input);document.body.appendChild(form);form.submit();document.body.removeChild(form);
    window.showToast("Emergency plan PDF is being prepared.");
  }

  /* ── Controls binding ── */
  function bindScenarioControls() {
    var locationSelect=document.getElementById("simLocation"),severitySelect=document.getElementById("simSeverity"),
        timeSelect=document.getElementById("simTime"),routeBtn=document.getElementById("simRouteBtn"),
        locateBtn=document.getElementById("routeLocateBtn"),planBtn=document.getElementById("simPlanBtn"),
        impactToggle=document.getElementById("simImpactToggle"),actionToggle=document.getElementById("simActionToggle");

    if (locationSelect) {
      var refreshLoc=function(e){
        if(e&&e.type==="keydown"&&e.key!=="Enter"&&e.key!==" ")return;
        if(e&&e.type==="keydown")e.preventDefault();
        state.lastRoute=null;routeOptions=[];activeRouteKey=null;
        refreshScenarioCurrentLocation(true).then(function(){resetExpandedLists();renderScenario();renderRouteOptionsUI();warmGeocoding();});
      };
      locationSelect.addEventListener("click",refreshLoc);
      locationSelect.addEventListener("keydown",refreshLoc);
      locationSelect.addEventListener("focus",syncScenarioLocationSelect);
    }

    if(severitySelect)severitySelect.addEventListener("change",function(){state.severity=this.value;state.lastRoute=null;routeOptions=[];activeRouteKey=null;resetExpandedLists();renderScenario();renderRouteOptionsUI();});
    if(timeSelect)timeSelect.addEventListener("change",function(){state.time=this.value;resetExpandedLists();renderScenario();});
    if(impactToggle)impactToggle.addEventListener("click",function(){state.expanded.impact=!state.expanded.impact;renderScenario();});
    if(actionToggle)actionToggle.addEventListener("click",function(){state.expanded.action=!state.expanded.action;renderScenario();});
    if(routeBtn)routeBtn.addEventListener("click",function(){calculateBestRoute();});
    if(planBtn)planBtn.addEventListener("click",downloadPlan);

    // "Use My Location" button — triggers GPS then shows the search group
    if(locateBtn) {
      locateBtn.addEventListener("click",function(){calculateBestRoute();});
    }
  }

  function bindRoutePlaceButtons() {
    document.addEventListener("click",function(e){
      var btn=e.target.closest("[data-route-place]"); if(!btn)return;
      calculateBestRoute(btn.getAttribute("data-route-place"));
    });
  }

  async function warmGeocoding() {
    try{await ensurePlacesGeocoded(locations[state.location].safePlaces);renderPlaces(locations[state.location].safePlaces);}catch(e){console.warn(e);}
  }

  function activateScenario(scenarioKey) {
    if(!scenarios[scenarioKey])return;
    state.scenario=scenarioKey;state.lastRoute=null;routeOptions=[];activeRouteKey=null;
    resetExpandedLists();renderScenario();renderRouteOptionsUI();setActiveScenarioButtons();
    window.showToast(scenarios[scenarioKey].title+" activated.");
  }

  function bindScenarioTabClicks() {
    document.querySelectorAll(".scenario-tab").forEach(function(btn){
      btn.addEventListener("click",function(){activateScenario(btn.getAttribute("data-scenario"));});
    });
  }

  window.simulateFlood=function(){activateScenario("flood");};
  window.simulateFire=function(){activateScenario("fire");};
  window.simulateStorm=function(){activateScenario("storm");};
  window.simulateRoadblock=function(){activateScenario("roadblock");};
  window.simulateQuake=function(){activateScenario("quake");};
  window.simulateMedical=function(){activateScenario("medical");};

  /* ── DOMContentLoaded ── */
  document.addEventListener("DOMContentLoaded",function(){
    bindScenarioControls();
    bindScenarioTabClicks();
    bindRoutePlaceButtons();
    bindHubRouteOptionClicks();
    bindCenterSearchInput();
    syncScenarioLocationSelect();

    // Initial render using PHP-registered town as safe fallback (no Bacolod assumption)
    var townKey=window.USER_REGISTERED_TOWN||"Bacolod";
    window.EVACUATION_CENTERS=window.ALL_EVACUATION_CENTERS[townKey]||window.ALL_EVACUATION_CENTERS["Bacolod"];
    renderScenario();

    // Immediately try to get real GPS — applyScenarioCoords will:
    // 1. Set the nearest location key (bacolod/iloilo/capiz/antique)
    // 2. Update EVACUATION_CENTERS to the flat distance-ranked pool for that position
    // 3. Reveal the blue/red pill search group and hide the "Use My Location" button
    refreshScenarioCurrentLocation(false).then(function(){
      renderScenario();
      renderRouteOptionsUI();
    }).catch(function(){
      renderScenario();
    });
  });

})(); // end scenario IIFE