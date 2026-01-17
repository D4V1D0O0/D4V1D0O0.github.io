
let openSwishBtn = document.getElementById("openSwish");

openSwishBtn.onclick = function() {
    window.location = "swish://paymentrequest?receiver=0701234567&amount=125&message=Test";
}